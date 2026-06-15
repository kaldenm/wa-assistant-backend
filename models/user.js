// src/models/user.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  clientId: {
    type: String,
    required: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Static methods (equivalent to your current functions but using the database)
userSchema.statics.formatPhoneNumber = function(phoneNumber) {
  return phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
};

userSchema.statics.getUserByClientId = async function(clientId) {
  return this.findOne({ clientId });
};

userSchema.statics.getUserByUsername = async function(username) {
  return this.findOne({ username });
};

userSchema.statics.getUserByPhone = async function(phoneNumber) {
  const clientId = this.formatPhoneNumber(phoneNumber);
  return this.findOne({ clientId });
};

userSchema.statics.getLoggedInUsers = async function(activeSessions) {
  return this.find({ username: { $in: activeSessions } });
};

const User = mongoose.model('User', userSchema);

module.exports = User;