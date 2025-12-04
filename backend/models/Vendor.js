const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
  },
  password: { type: String, required: true },
  locality: { type: String, required: true },
  service: { type: String, required: true },
  scannerCode: {
    type: String,
    unique: true,
    default: () =>
      'SCAN-' + Math.random().toString(36).slice(2, 11).toUpperCase()
  },
  vegetables: [
    {
      name: { type: String, required: true },
      rate: { type: Number, required: true },
      area: { type: String, required: true },
      available: { type: Boolean, default: true }
    }
  ]
});

module.exports = mongoose.model('Vendor', VendorSchema);
