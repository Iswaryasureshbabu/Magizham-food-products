'use strict';

/**
 * API router.
 */

const express = require('express');

const authRoutes = require('./auth.routes');
const catalogRoutes = require('./catalog.routes');
const cartRoutes = require('./cart.routes');
const orderRoutes = require('./order.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/', catalogRoutes); // /categories and /products

module.exports = router;
