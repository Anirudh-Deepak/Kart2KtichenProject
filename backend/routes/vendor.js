const express = require('express');
const bcrypt = require('bcryptjs');
const Vendor = require('../models/Vendor');

const router = express.Router();

/* ---------------- VENDOR REGISTER ---------------- */
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, locality, service } = req.body;

    if (!name || !phone || !password || !locality) {
      return res.status(400).json({
        error: 'All fields (name, phone, password, locality) required'
      });
    }

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
      service: service || 'General'
    });

    await vendor.save();

    res.status(201).json({
      message: 'Vendor registered successfully',
      scannerCode: vendor.scannerCode
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ---------------- VENDOR LOGIN ---------------- */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const vendor = await Vendor.findOne({ phone });
    if (!vendor) {
      return res.status(400).json({ error: 'Vendor not found' });
    }

    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    res.status(200).json({
      message: 'Vendor logged in successfully',
      vendor: {
        name: vendor.name,
        phone: vendor.phone,
        locality: vendor.locality,
        service: vendor.service,
        scannerCode: vendor.scannerCode
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==================================================
   USER DASHBOARD: ALL VEGETABLES FROM ALL VENDORS
   --------------------------------------------------
   NOTE: This MUST come BEFORE '/:phone/vegetables'
   or Express will treat "vegetables" as a :phone param.
   ================================================== */
router.get('/vegetables', async (req, res) => {
  try {
    // Get basic vendor info and their vegetables
    const vendors = await Vendor.find(
      {},
      'name phone locality scannerCode vegetables'
    );

    const items = [];

    vendors.forEach((v) => {
      (v.vegetables || []).forEach((veg) => {
        // show only available items to users
        if (veg.available === false) return;

        items.push({
          _id: veg._id,
          name: veg.name,
          rate: veg.rate,
          area: veg.area,
          available: veg.available,
          vendor: {
            name: v.name,
            phone: v.phone,
            locality: v.locality,
            scannerCode: v.scannerCode
          }
        });
      });
    });

    return res.json(items);
  } catch (err) {
    console.error('Error in GET /vegetables:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ---------------- ADD VEGETABLE ---------------- */
router.post('/add_vegetable', async (req, res) => {
  try {
    const { phone, vegetable } = req.body;

    if (!phone || !vegetable || !vegetable.name || vegetable.rate == null) {
      return res
        .status(400)
        .json({ error: 'phone and vegetable {name, rate} required' });
    }

    const vendor = await Vendor.findOne({ phone });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    vendor.vegetables.push({
      name: vegetable.name,
      rate: Number(vegetable.rate),
      area: vegetable.area || vendor.locality,
      available: true
    });

    await vendor.save();
    res.json({ message: 'Vegetable added', vegetables: vendor.vegetables });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ---------------- LIST VEGETABLES FOR ONE VENDOR ---------------- */
router.get('/:phone/vegetables', async (req, res) => {
  try {
    const vendor = await Vendor.findOne(
      { phone: req.params.phone },
      'vegetables'
    );
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(vendor.vegetables);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ---------------- EDIT VEGETABLE ---------------- */
router.put('/:phone/vegetables/:vegId', async (req, res) => {
  try {
    const { phone, vegId } = req.params;
    const { name, rate, area, available } = req.body;

    const vendor = await Vendor.findOne({ phone });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const veg = vendor.vegetables.id(vegId);
    if (!veg) {
      return res.status(404).json({ error: 'Vegetable not found' });
    }

    if (name != null) veg.name = name;
    if (rate != null) veg.rate = Number(rate);
    if (area != null) veg.area = area;
    if (available !== undefined) veg.available = !!available;

    await vendor.save();
    res.json({ message: 'Vegetable updated', vegetable: veg });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ---------------- DELETE VEGETABLE ---------------- */
router.delete('/:phone/vegetables/:vegId', async (req, res) => {
  try {
    const { phone, vegId } = req.params;

    const vendor = await Vendor.findOne({ phone });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const veg = vendor.vegetables.id(vegId);
    if (!veg) {
      return res.status(404).json({ error: 'Vegetable not found' });
    }

    veg.deleteOne();
    await vendor.save();

    res.json({ message: 'Vegetable deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
