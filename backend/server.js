// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

// ✅ Shared models
const User = require('./models/User');
const Vendor = require('./models/Vendor');
const Order = require('./models/Order'); // ✅ NEW

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kart2kitchen';

// ----------------- DB CONNECTION -----------------
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ==================================================
//                     VENDOR ROUTES
// ==================================================

// Vendor register  (POST /vendor_register)
app.post('/vendor_register', async (req, res) => {
  try {
    let { name, phone, password, locality, service } = req.body;

    if (!name || !phone || !password || !locality) {
      return res
        .status(400)
        .json({ error: 'All fields (name, phone, password, locality) are required' });
    }

    if (!service || service.trim() === '') service = 'General';

    const existing = await Vendor.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const vendor = new Vendor({
      name,
      phone,
      password: hashedPassword,
      locality,
      service
    });
    await vendor.save();

    res.status(201).json({
      message: 'Vendor registered successfully',
      scannerCode: vendor.scannerCode
    });
  } catch (err) {
    if (err.errors && err.errors.phone) {
      return res.status(400).json({ error: err.errors.phone.message });
    }
    if (err.code === 11000 && err.keyPattern && err.keyPattern.scannerCode) {
      return res
        .status(500)
        .json({ error: 'Scanner code collision. Please retry registration.' });
    }
    console.error('POST /vendor_register error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Vendor login  (POST /vendor_login)
app.post('/vendor_login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const vendor = await Vendor.findOne({ phone });
    if (!vendor) return res.status(400).json({ error: 'Vendor not found' });

    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    res.status(200).json({
      message: 'Vendor logged in successfully',
      vendor: {
        name: vendor.name,
        phone: vendor.phone,
        locality: vendor.locality,
        service: vendor.service || 'General',
        scannerCode: vendor.scannerCode
      }
    });
  } catch (err) {
    console.error('POST /vendor_login error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Add vegetable  (POST /vendor_add_vegetable)
app.post('/vendor_add_vegetable', async (req, res) => {
  try {
    const { phone, vegetable } = req.body;
    if (
      !phone ||
      !vegetable ||
      !vegetable.name ||
      vegetable.rate == null ||
      !vegetable.area
    ) {
      return res.status(400).json({
        error: 'phone and vegetable {name, rate, area} are required'
      });
    }

    const rateNum = Number(vegetable.rate);
    if (Number.isNaN(rateNum) || rateNum < 0) {
      return res
        .status(400)
        .json({ error: 'rate must be a non-negative number' });
    }

    const vendor = await Vendor.findOne({ phone });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    vendor.vegetables.push({
      name: vegetable.name.trim(),
      rate: rateNum,
      area: vegetable.area.trim(),
      available: true
    });
    await vendor.save();

    res.json({ message: 'Vegetable added', vegetables: vendor.vegetables });
  } catch (err) {
    console.error('POST /vendor_add_vegetable error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Get vegetables for a specific vendor  (GET /vendor/:phone/vegetables)
app.get('/vendor/:phone/vegetables', async (req, res) => {
  try {
    const vendor = await Vendor.findOne(
      { phone: req.params.phone },
      'vegetables'
    );
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor.vegetables || []);
  } catch (err) {
    console.error('GET /vendor/:phone/vegetables error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update vegetable (name/rate/area/available)
app.put('/vendor/:phone/vegetables/:vegId', async (req, res) => {
  try {
    const { phone, vegId } = req.params;
    const { name, rate, area, available } = req.body;

    const vendor = await Vendor.findOne({ phone });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const veg = vendor.vegetables.id(vegId);
    if (!veg) return res.status(404).json({ error: 'Vegetable not found' });

    if (name != null) veg.name = name;
    if (rate != null) {
      const rateNum = Number(rate);
      if (Number.isNaN(rateNum) || rateNum < 0) {
        return res
          .status(400)
          .json({ error: 'rate must be a non-negative number' });
      }
      veg.rate = rateNum;
    }
    if (area != null) veg.area = area;
    if (typeof available === 'boolean') veg.available = available;

    await vendor.save();
    res.json({ message: 'Vegetable updated', vegetable: veg });
  } catch (err) {
    console.error('PUT /vendor/:phone/vegetables/:vegId error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Delete vegetable  (DELETE /vendor/:phone/vegetables/:vegId)
app.delete('/vendor/:phone/vegetables/:vegId', async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ phone: req.params.phone });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const veg = vendor.vegetables.id(req.params.vegId);
    if (!veg) return res.status(404).json({ error: 'Vegetable not found' });

    veg.deleteOne();
    await vendor.save();
    res.json({ message: 'Vegetable deleted' });
  } catch (err) {
    console.error('DELETE /vendor/:phone/vegetables/:vegId error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ==================================================
//                      USER ROUTES
// ==================================================

// User register  (POST /user_register)
app.post('/user_register', async (req, res) => {
  try {
    const { name, phone, password, locality } = req.body;

    if (!name || !phone || !password || !locality) {
      return res.status(400).json({
        error: 'All fields (name, phone, password, locality) are required'
      });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, phone, password: hashedPassword, locality });
    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.errors && err.errors.phone) {
      return res.status(400).json({ error: err.errors.phone.message });
    }
    console.error('POST /user_register error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// User login  (POST /user_login)
app.post('/user_login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const vendors = await Vendor.find(
      {},
      'name phone locality service scannerCode'
    );

    res.status(200).json({
      message: 'User logged in successfully',
      user: {
        name: user.name,
        phone: user.phone,
        locality: user.locality
      },
      vendors
    });
  } catch (err) {
    console.error('POST /user_login error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ==================================================
//                    COMMON LIST ROUTES
// ==================================================

// All vendors (basic info)  (GET /vendors)
app.get('/vendors', async (req, res) => {
  try {
    const vendors = await Vendor.find(
      {},
      'name phone locality service scannerCode'
    );
    res.json(vendors);
  } catch (err) {
    console.error('GET /vendors error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// All vegetables (flattened, only available ones)  (GET /vegetables)
app.get('/vegetables', async (req, res) => {
  try {
    const vendors = await Vendor.find(
      {},
      'name phone locality scannerCode vegetables'
    ).lean();

    const items = [];
    vendors.forEach((v) => {
      if (!v.vegetables) return;
      v.vegetables.forEach((veg) => {
        if (veg.available === false) return; // hide unavailable from users
        items.push({
          _id: veg._id,
          name: veg.name,
          rate: veg.rate,
          area: veg.area,
          vendor: {
            name: v.name,
            phone: v.phone,
            locality: v.locality,
            scannerCode: v.scannerCode
          }
        });
      });
    });

    res.json(items);
  } catch (err) {
    console.error('GET /vegetables error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ==================================================
//                      ORDER ROUTES
// ==================================================

// POST /orders -> create one order per vendor from cart
app.post('/orders', async (req, res) => {
  try {
    const { user, paymentMethod, deliveryAddress, items } = req.body;

    if (!user || !user.name || !user.phone || !user.locality) {
      return res.status(400).json({ error: 'Invalid user information' });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    // Group items by vendor
    const byVendor = {};
    items.forEach((it) => {
      if (!it.vendorPhone) return;
      if (!byVendor[it.vendorPhone]) {
        byVendor[it.vendorPhone] = {
          vendorPhone: it.vendorPhone,
          vendorName: it.vendorName,
          vendorLocality: it.vendorLocality,
          items: []
        };
      }
      byVendor[it.vendorPhone].items.push({
        vegId: it.vegId,
        name: it.name,
        qty: Number(it.qty) || 1,
        rate: Number(it.rate)
      });
    });

    const ordersToSave = Object.values(byVendor).map((group) => {
      const total = group.items.reduce(
        (sum, it) => sum + it.rate * it.qty,
        0
      );
      return new Order({
        userPhone: user.phone,
        userName: user.name,
        userLocality: user.locality,

        vendorPhone: group.vendorPhone,
        vendorName: group.vendorName,
        vendorLocality: group.vendorLocality,

        items: group.items,
        totalAmount: total,
        paymentMethod: paymentMethod || 'COD',
        deliveryAddress,
        status: 'PENDING'
      });
    });

    if (!ordersToSave.length) {
      return res.status(400).json({ error: 'No valid vendor items in order' });
    }

    const savedOrders = await Order.insertMany(ordersToSave);

    res.status(201).json({
      message: 'Order(s) placed successfully',
      orders: savedOrders
    });
  } catch (err) {
    console.error('POST /orders error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /user/:phone/orders -> user order history
app.get('/user/:phone/orders', async (req, res) => {
  try {
    const orders = await Order.find({ userPhone: req.params.phone })
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch (err) {
    console.error('GET /user/:phone/orders error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /vendor/:phone/orders -> vendor incoming orders
app.get('/vendor/:phone/orders', async (req, res) => {
  try {
    const orders = await Order.find({ vendorPhone: req.params.phone })
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch (err) {
    console.error('GET /vendor/:phone/orders error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PUT /orders/:id/status -> vendor updates status
app.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    await order.save();

    res.json({ message: 'Order status updated', order });
  } catch (err) {
    console.error('PUT /orders/:id/status error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ==================================================
//                     HEALTH CHECK
// ==================================================
app.get('/', (req, res) => res.send('Backend running'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
