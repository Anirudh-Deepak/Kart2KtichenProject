const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
    },
    password: { type: String, required: true },
    // locality is REQUIRED so we can restrict vendors & orders
    locality: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
