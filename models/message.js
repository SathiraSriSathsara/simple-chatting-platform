const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  from: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'sender' // <- This tells Sequelize the actual column in the DB is called 'sender'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  }
});

module.exports = Message;
