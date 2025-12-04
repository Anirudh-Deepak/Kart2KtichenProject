// backend/models/Order.js
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    // USER INFO
    userPhone: { type: String, required: true },
    userName: { type: String, required: true },
    userLocality: { type: String, required: true },

    // VENDOR INFO
    vendorPhone: { type: String, required: true },
    vendorName: { type: String, required: true },
    vendorLocality: { type: String, required: true },

    // ITEMS IN THIS ORDER (ONLY FOR THIS VENDOR)
    items: [
      {
        vegId: String,
        name: String,
        qty: Number,
        rate: Number
      }
    ],

    totalAmount: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ['COD', 'UPI'],
      default: 'COD'
    },

    deliveryAddress: { type: String, required: true },

    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'],
      default: 'PENDING'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
