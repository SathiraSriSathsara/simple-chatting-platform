var WAFullScreenChat = {
	socket: null,
	loading: document.getElementById("loading"),
	chat_box: document.getElementById("chat-box"),
	msgs_list: document.getElementById("msgs"),
	typing_list: document.getElementById("typing"),
	users: document.getElementById("users"),
	textarea: document.getElementById("form_input"),
	send_btn: document.getElementById("send"),
	attach_btn: document.getElementById("attach_btn"),
	file_input: null,
	is_focused: false,
	is_online: false,
	is_typing: false,
	last_sent_nick: null,
	original_title: document.title,
	new_title: "New messages...",

	scroll: function () {
		setTimeout(function () {
			WAFullScreenChat.chat_box.scrollTop = WAFullScreenChat.chat_box.scrollHeight;
		}, 0)
	},

	notif: {
		enabled: true,
		ttout: undefined,
		active: undefined,
		msgs: 0,
		beep: undefined,
		beep_create: function () {
			var audiotypes = {
				"mp3": "audio/mpeg", "mp4": "audio/mp4",
				"ogg": "audio/ogg", "wav": "audio/wav"
			};
			var audios = ['static/beep.ogg'];
			var audio_element = document.createElement('audio');
			if (audio_element.canPlayType) {
				for (var i = 0; i < audios.length; i++) {
					var source_element = document.createElement('source');
					source_element.setAttribute('src', audios[i]);
					if (audios[i].match(/\.(\w+)$/i)) {
						source_element.setAttribute('type', audiotypes[RegExp.$1]);
					}
					audio_element.appendChild(source_element);
				}
				audio_element.load();
				audio_element.playclip = function () {
					audio_element.pause();
					audio_element.volume = 0.5;
					audio_element.currentTime = 0;
					audio_element.play();
				};
				return audio_element;
			}
		},
		create: function (from, message) {
			if (WAFullScreenChat.is_focused || !WAFullScreenChat.notif.enabled) return;
			WAFullScreenChat.notif.msgs++;
			WAFullScreenChat.notif.favicon('blue');
			document.title = '(' + WAFullScreenChat.notif.msgs + ') ' + WAFullScreenChat.new_title;
			if (typeof WAFullScreenChat.notif.ttout === "undefined") {
				WAFullScreenChat.notif.ttout = setInterval(function () {
					if (document.title == WAFullScreenChat.original_title) {
						WAFullScreenChat.notif.favicon('blue');
						document.title = '(' + WAFullScreenChat.notif.msgs + ') ' + WAFullScreenChat.new_title;
					} else {
						WAFullScreenChat.notif.favicon('green');
						document.title = WAFullScreenChat.original_title;
					}
				}, 1500);
			}
			WAFullScreenChat.notif.beep.playclip();
			if (Notification.permission !== "granted") {
				Notification.requestPermission();
				return;
			}
			WAFullScreenChat.notif.clear();
			from = from.replace(/(<([^>]+)>)/ig, "");
			message = message.text?.replace(/(<([^>]+)>)/ig, "");
			WAFullScreenChat.notif.active = new Notification(from, {
				icon: 'static/images/favicon-blue.png',
				body: message,
			});
			WAFullScreenChat.notif.active.onclick = function () {
				parent.focus();
				window.focus();
			};
		},
		clear: function () {
			typeof WAFullScreenChat.notif.active === "undefined" || WAFullScreenChat.notif.active.close();
		},
		favicon: function (color) {
			var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
			link.type = 'image/x-icon';
			link.rel = 'shortcut icon';
			link.href = 'static/images/favicon-' + color + '.ico';
			document.getElementsByTagName('head')[0].appendChild(link);
		}
	},

	send_msg: function (text) {
		WAFullScreenChat.socket.emit("send-msg", { m: text });
	},

	send_event: function () {
		var value = WAFullScreenChat.textarea.value.trim();
		if (value == "") return;
		WAFullScreenChat.send_msg({ text: value });
		WAFullScreenChat.textarea.value = '';
		WAFullScreenChat.typing.update();
		WAFullScreenChat.textarea.focus();
	},

	typing: {
		objects: {},
		create: function (nick) {
			var li = document.createElement('li');
			var msg = document.createElement('div');
			msg.className = 'wa-bubble';
			var body = document.createElement('span');
			body.className = 'body writing'
			body.innerHTML = '<span class="one">&bull;</span><span class="two">&bull;</span><span class="three">&bull;</span>';
			msg.appendChild(body);
			li.appendChild(msg);
			WAFullScreenChat.typing_list.appendChild(li);
			WAFullScreenChat.typing.objects[nick] = li;
			WAFullScreenChat.scroll();
		},
		remove: function (nick) {
			if (WAFullScreenChat.typing.objects.hasOwnProperty(nick)) {
				var element = WAFullScreenChat.typing.objects[nick];
				element.parentNode.removeChild(element);
				delete WAFullScreenChat.typing.objects[nick];
			}
		},
		event: function (r) {
			if (r.status) {
				WAFullScreenChat.typing.create(r.nick);
			} else {
				WAFullScreenChat.typing.remove(r.nick);
			}
		},
		update: function () {
			if (WAFullScreenChat.is_typing && WAFullScreenChat.textarea.value === "") {
				WAFullScreenChat.socket.emit("typing", WAFullScreenChat.is_typing = false);
			}
			if (!WAFullScreenChat.is_typing && WAFullScreenChat.textarea.value !== "") {
				WAFullScreenChat.socket.emit("typing", WAFullScreenChat.is_typing = true);
			}
		}
	},

	new_msg: function (r) {
		const fromSelf = sessionStorage.nick == r.f;
		WAFullScreenChat.notif.create(r.f, r.m);

		var li = document.createElement('li');
		li.className = fromSelf ? "out" : "";

		// Bubbles
		var msg = document.createElement('div');
		msg.className = 'wa-bubble';
		var body = document.createElement('span');
		body.className = 'body';
		WAFullScreenChat.append_msg(body, r.m);
		msg.appendChild(body);

		// Meta
		var meta = document.createElement('div');
		meta.className = 'wa-meta';
		var user = document.createElement('span');
		user.className = 'wa-user';
		user.innerText = r.f;
		var time = document.createElement('span');
		time.className = 'wa-time';
		time.innerText = r.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		meta.appendChild(user);
		meta.appendChild(time);

		li.appendChild(msg);
		li.appendChild(meta);

		WAFullScreenChat.msgs_list.prepend(li);
		WAFullScreenChat.scroll();
	},

	append_msg: function (el, msg) {
		if (!msg) return;
		if (typeof msg.text !== 'undefined') {
			el.innerText = msg.text;
			var text = el.innerHTML;
			text = text.replace(/(https?:\/\/[^\s]+)/g, function (url, a, b) {
				var link = document.createElement('a');
				link.target = "_blank";
				link.innerHTML = url;
				url = link.innerText;
				link.href = url;
				if (url.match(/.(png|jpe?g|gifv?)([?#].*)?$/g)) {
					var img = document.createElement('img');
					img.style = 'max-width:100%;border-radius:1em;margin-top:8px;';
					img.src = url;
					link.innerText = "";
					link.appendChild(img);
				}
				return link.outerHTML;
			});
			if (typeof Emic !== 'undefined') {
				text = Emic.replace(text);
			}
			el.innerHTML = text;
		}
		if (typeof msg.type !== 'undefined') {
			if (msg.type.match(/image.*/)) {
				var img = document.createElement('img');
				img.style = 'max-width:100%;border-radius:1em;margin-top:8px;';
				img.src = msg.url;
				el.appendChild(img);
				return;
			}
			if (m = msg.type.match(/(audio|video).*/)) {
				var audio = document.createElement(m[1]);
				audio.controls = 'controls';
				var source = document.createElement("source");
				source.src = msg.url;
				source.type = msg.type;
				audio.appendChild(source);
				el.appendChild(audio);
				return;
			}
			var link = document.createElement('a');
			link.href = msg.url;
			link.download = msg.name;
			link.innerText = msg.name;
			el.appendChild(link);
		}
	},

	force_login: function (fail) {
		if (typeof fail !== "undefined") {
			alert(fail);
		}
		var nick = prompt("Your nick:", sessionStorage.nick || localStorage.nick || "").trim();
		if (typeof nick !== "undefined" && nick) {
			sessionStorage.nick = localStorage.nick = nick;
			WAFullScreenChat.socket.emit("login", { nick: nick });
		}
	},

	reload: function () {
		if (typeof sessionStorage.nick !== "undefined" && sessionStorage.nick) {
			WAFullScreenChat.socket.emit("login", { nick: sessionStorage.nick });
		}
	},

	user: {
		objects: {},
		start: function (r) {
			WAFullScreenChat.users.innerText = '';
			for (var user in r.users) {
				var nick = document.createElement('li');
				nick.innerText = r.users[user];
				WAFullScreenChat.users.appendChild(nick);
				WAFullScreenChat.user.objects[r.users[user]] = nick;
			}
		},
		previous_messages: function (data) {
			data.msgs.forEach(element => {
				WAFullScreenChat.new_msg(element)
			});
		},
		enter: function (r) {
			var nick = document.createElement('li');
			nick.innerText = r.nick;
			WAFullScreenChat.users.appendChild(nick);
			WAFullScreenChat.user.objects[r.nick] = nick;
		},
		leave: function (r) {
			WAFullScreenChat.typing.remove(r.nick);
			if (WAFullScreenChat.user.objects.hasOwnProperty(r.nick)) {
				var element = WAFullScreenChat.user.objects[r.nick];
				element.parentNode.removeChild(element);
				delete WAFullScreenChat.user.objects[r.nick];
			}
		}
	},

	connect: function () {
		WAFullScreenChat.notif.favicon('green');
		WAFullScreenChat.is_online = true;
		document.getElementById('offline').style.display = "none";
		WAFullScreenChat.msgs_list.innerText = '';
		WAFullScreenChat.typing_list.innerText = '';
		WAFullScreenChat.users.innerText = '';
		WAFullScreenChat.last_sent_nick = '';
		WAFullScreenChat.force_login();
	},

	disconnect: function () {
		WAFullScreenChat.notif.favicon('red');
		WAFullScreenChat.is_online = false;
		document.getElementById('offline').style.display = "block";
		WAFullScreenChat.msgs_list.innerText = '';
		WAFullScreenChat.typing_list.innerText = '';
		WAFullScreenChat.users.innerText = '';
	},

	init: function (socket) {
		WAFullScreenChat.notif.favicon('red');
		WAFullScreenChat.socket = socket || io();
		WAFullScreenChat.notif.beep = WAFullScreenChat.notif.beep_create();

		WAFullScreenChat.attach_btn = document.getElementById("attach_btn");
		WAFullScreenChat.file_input = document.getElementById("file_input");

		WAFullScreenChat.attach_btn.onclick = function () {
			WAFullScreenChat.file_input.click();
		};

		WAFullScreenChat.file_input.onchange = function (e) {
			var files = e.target.files;
			WAFullScreenChat.send_files(files);
			WAFullScreenChat.file_input.value = "";
		};

		// Drag and drop hint is always present for clarity

		var dropZone = document.getElementsByTagName("body")[0];
		dropZone.addEventListener('dragover', function (e) {
			e.stopPropagation();
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			document.querySelector('.wa-drop-hint').style.background = "#fff5e2";
			document.querySelector('.wa-drop-hint').style.color = "#2563eb";
		});
		dropZone.addEventListener('dragleave', function (e) {
			document.querySelector('.wa-drop-hint').style.background = "#e9f5fc";
			document.querySelector('.wa-drop-hint').style.color = "#003d82";
		});
		dropZone.addEventListener('drop', function (e) {
			e.stopPropagation();
			e.preventDefault();
			document.querySelector('.wa-drop-hint').style.background = "#e9f5fc";
			document.querySelector('.wa-drop-hint').style.color = "#003d82";
			WAFullScreenChat.send_files(e.dataTransfer.files);
		});

		window.addEventListener('focus', function () {
			WAFullScreenChat.is_focused = true;
			if (!WAFullScreenChat.is_online) return;
			typeof WAFullScreenChat.notif.ttout === "undefined" || clearInterval(WAFullScreenChat.notif.ttout);
			WAFullScreenChat.notif.ttout = undefined;
			WAFullScreenChat.notif.clear();
			WAFullScreenChat.notif.msgs = 0;
			WAFullScreenChat.notif.favicon('green');
			document.title = WAFullScreenChat.original_title;
		});
		window.addEventListener('blur', function () {
			WAFullScreenChat.is_focused = false;
		});

		WAFullScreenChat.send_btn.onclick = WAFullScreenChat.send_event;
		WAFullScreenChat.textarea.onkeydown = function (e) {
			var key = e.keyCode || window.event.keyCode;
			if (key === 13) {
				WAFullScreenChat.send_event();
				return false;
			}
			return true;
		};
		WAFullScreenChat.textarea.onkeyup = WAFullScreenChat.typing.update;
		WAFullScreenChat.socket.on("connect", WAFullScreenChat.connect);
		WAFullScreenChat.socket.on("disconnect", WAFullScreenChat.disconnect);

		WAFullScreenChat.socket.on("force-login", WAFullScreenChat.force_login);
		WAFullScreenChat.socket.on("typing", WAFullScreenChat.typing.event);
		WAFullScreenChat.socket.on("new-msg", WAFullScreenChat.new_msg);

		WAFullScreenChat.socket.on("previous-msg", WAFullScreenChat.user.previous_messages)
		WAFullScreenChat.socket.on("start", WAFullScreenChat.user.start);
		WAFullScreenChat.socket.on("ue", WAFullScreenChat.user.enter);
		WAFullScreenChat.socket.on("ul", WAFullScreenChat.user.leave);

		window.addEventListener("beforeunload", () => {
			if (!WAFullScreenChat.is_online) {
				return;
			}
			WAFullScreenChat.socket.disconnect();
		});
	},

	send_files: function (files) {
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			if (file.size > 10485760) {
				alert("Max size of file is 10MB");
				return;
			}
			var reader = new FileReader();
			reader.onload = (function (file) {
				return function (e) {
					WAFullScreenChat.send_msg({
						type: file.type,
						name: file.name,
						url: e.target.result
					});
				};
			})(file);
			reader.readAsDataURL(file);
		}
	}
};