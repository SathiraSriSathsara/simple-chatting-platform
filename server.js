require("dotenv").config();
const express = require("express");
const app = express();

const sequelize = require("./sequelize");
const Message = require("./models/message");

const path = require("path");
const html = path.join(__dirname, "/html");
app.use(express.static(html));

const port = process.argv[2] || 8090;
const http = require("http").Server(app);

const maxHttpBufferSizeInMb = parseInt(
  process.env.MAX_HTTP_BUFFER_SIZE_MB || "1"
);
const io = require("socket.io")(http, {
  maxHttpBufferSize: maxHttpBufferSizeInMb * 1024 * 1024,
});
let messageCache = [];
let cache_size = process.env.CACHE_SIZE
  ? parseInt(process.env.CACHE_SIZE)
  : 100;

sequelize
  .sync()
  .then(() => {
    console.log("All models were synchronized successfully.");
  })
  .catch((err) => {
    console.error("Failed to sync models:", err);
  });

http.listen(port, function () {
  console.log("Starting server on port %s", port);
});

const users = [];
let msg_id = 1;
io.sockets.on("connection", function (socket) {
  console.log("New connection!");

  var nick = null;

  socket.on("login", function (data) {
    data.nick = data.nick.trim();

    if (data.nick == "") {
      socket.emit("force-login", "Nick can't be empty.");
      nick = null;
      return;
    }
    if (users.indexOf(data.nick) != -1) {
      socket.emit("force-login", "This nick is already in chat.");
      nick = null;
      return;
    }

    nick = data.nick;
    users.push(data.nick);

    console.log("User %s joined.", nick.replace(/(<([^>]+)>)/gi, ""));
    socket.join("main");

    io.to("main").emit("ue", { nick: nick });

    socket.emit("start", {
      users: users,
    });

    console.log(`going to send DB messages to ${nick}`);

    Message.findAll({
      order: [["createdAt", "ASC"]],
      limit: parseInt(cache_size),
    })
      .then((messages) => {
        const msgs = messages.map((msg) => {
          let parsedMessage;
          try {
            parsedMessage = JSON.parse(msg.message);
            // If parsing succeeded but not an object, fallback
            if (
              !parsedMessage ||
              typeof parsedMessage !== "object" ||
              !parsedMessage.text
            ) {
              parsedMessage = { text: msg.message };
            }
          } catch (err) {
            parsedMessage = { text: msg.message };
          }
          return {
            id: msg.id,
            f: msg.from,
            m: parsedMessage,
          };
        });

        socket.emit("previous-msg", { msgs });
      })
      .catch((err) => {
        console.error("Failed to load messages:", err);
      });
  });

  socket.on("send-msg", function (data) {
    if (nick == null) {
      socket.emit("force-login", "You need to be logged in to send message.");
      return;
    }

    let textObj;
    if (typeof data.m === "string") {
      textObj = { text: data.m };
    } else if (typeof data.m === "object" && data.m !== null && data.m.text) {
      textObj = data.m;
    } else {
      textObj = { text: String(data.m) };
    }

    const id = "msg_" + msg_id++;
    const msg = {
      f: nick,
      m: textObj,
      id: id,
    };

    Message.create({
      id: id,
      from: nick,
      message: JSON.stringify(textObj),
    })
      .then(() => {
        io.to("main").emit("new-msg", msg);
        console.log("User %s sent message.", nick.replace(/(<([^>]+)>)/gi, ""));
      })
      .catch((err) => {
        console.error("Failed to save message:", err);
      });
  });

  socket.on("typing", function (typing) {
    if (nick != null) {
      socket.broadcast.to("main").emit("typing", {
        status: typing,
        nick: nick,
      });

      console.log(
        "%s %s typing.",
        nick.replace(/(<([^>]+)>)/gi, ""),
        typing ? "is" : "is not"
      );
    }
  });

  socket.on("disconnect", function () {
    console.log("Got disconnect!");

    if (nick != null) {
      users.splice(users.indexOf(nick), 1);
      io.to("main").emit("ul", { nick: nick });
      console.log("User %s left.", nick.replace(/(<([^>]+)>)/gi, ""));
      socket.leave("main");
      nick = null;
    }
  });
});