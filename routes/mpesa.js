const express = require('express');
const router = express.Router();
const {
  initiateSubscription,
  mpesaCallback,
  checkPaymentStatus,
} = require('../controllers/mpesaController');

/**
 * @route   POST /api/mpesa/subscribe
 * @desc    Initiate subscription payment via M-Pesa STK Push
 * @access  Public
 */
router.post('/subscribe', initiateSubscription);

/**
 * @route   POST /api/mpesa/callback
 * @desc    M-Pesa callback for payment confirmation
 * @access  Public
 */
router.post('/callback', mpesaCallback);

/**
 * @route   GET /api/mpesa/status/:checkoutRequestId
 * @desc    Check payment status
 * @access  Public
 */
router.get('/status/:checkoutRequestId', checkPaymentStatus);

module.exports = router;
