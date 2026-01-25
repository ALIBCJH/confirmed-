const axios = require('axios');

// M-Pesa Daraja API credentials (Sandbox)
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'your_consumer_key';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'your_consumer_secret';
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || '174379'; // Sandbox shortcode
const PASSKEY = process.env.MPESA_PASSKEY || 'your_passkey';
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'https://your-domain.com/api/mpesa/callback';

// Test mode flag - set to true if credentials are not configured
const TEST_MODE = CONSUMER_KEY === 'your_consumer_key' || !CONSUMER_KEY || CONSUMER_KEY.includes('your_');

// Sandbox URLs
const AUTH_URL = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const STK_PUSH_URL = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

/**
 * Generate OAuth access token
 */
const getAccessToken = async () => {
  if (TEST_MODE) {
    console.log('⚠️ M-Pesa TEST MODE: Skipping real authentication');
    return 'test_access_token';
  }

  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    
    const response = await axios.get(AUTH_URL, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting M-Pesa access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with M-Pesa');
  }
};

/**
 * Generate password for STK push
 */
const generatePassword = () => {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`).toString('base64');
  return { password, timestamp };
};

/**
 * Format phone number to 254XXXXXXXXX format
 */
const formatPhoneNumber = (phone) => {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  }
  
  // If doesn't start with 254, add it
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  
  return cleaned;
};

/**
 * Initiate STK Push
 */
const initiateSTKPush = async (phoneNumber, amount, accountReference, transactionDesc) => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // TEST MODE: Simulate STK push without real M-Pesa API
    if (TEST_MODE) {
      console.log('⚠️ M-Pesa TEST MODE: Simulating STK Push');
      console.log('📱 Test STK Push:', {
        phone: formattedPhone,
        amount,
        reference: accountReference,
      });

      // Generate mock checkout request ID
      const mockCheckoutId = `TEST_CO_${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        message: 'STK push sent successfully (TEST MODE)',
        data: {
          merchantRequestId: `TEST_MR_${Date.now()}`,
          checkoutRequestId: mockCheckoutId,
          responseCode: '0',
          responseDescription: 'Success. Request accepted for processing (TEST MODE)',
          customerMessage: 'Success. Request accepted for processing (TEST MODE)',
        },
      };
    }

    // REAL MODE: Actual M-Pesa API integration
    const accessToken = await getAccessToken();
    const { password, timestamp } = generatePassword();

    const requestBody = {
      BusinessShortCode: BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount), // Amount must be integer
      PartyA: formattedPhone,
      PartyB: BUSINESS_SHORT_CODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: accountReference || 'CONFIRMED',
      TransactionDesc: transactionDesc || 'Payment for service',
    };

    console.log('📱 Initiating STK Push:', {
      phone: formattedPhone,
      amount,
      reference: accountReference,
    });

    const response = await axios.post(STK_PUSH_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ STK Push initiated:', response.data);

    return {
      success: true,
      message: 'STK push sent successfully',
      data: {
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      },
    };
  } catch (error) {
    console.error('❌ STK Push error:', error.response?.data || error.message);
    
    return {
      success: false,
      message: error.response?.data?.errorMessage || 'Failed to initiate payment',
      error: error.response?.data || error.message,
    };
  }
};

/**
 * Handle M-Pesa callback (payment confirmation)
 */
const handleCallback = (callbackData) => {
  try {
    const { Body } = callbackData;
    const { stkCallback } = Body;

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
    } = stkCallback;

    if (ResultCode === 0) {
      // Payment successful
      const { CallbackMetadata } = stkCallback;
      const items = CallbackMetadata.Item;

      const amount = items.find(item => item.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = items.find(item => item.Name === 'TransactionDate')?.Value;
      const phoneNumber = items.find(item => item.Name === 'PhoneNumber')?.Value;

      console.log('✅ Payment successful:', {
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID,
        amount,
        mpesaReceiptNumber,
        transactionDate,
        phoneNumber,
      });

      return {
        success: true,
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID,
        amount,
        mpesaReceiptNumber,
        transactionDate,
        phoneNumber,
      };
    } else {
      // Payment failed or cancelled
      console.log('❌ Payment failed:', ResultDesc);
      
      return {
        success: false,
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      };
    }
  } catch (error) {
    console.error('❌ Error handling M-Pesa callback:', error);
    throw error;
  }
};

module.exports = {
  initiateSTKPush,
  handleCallback,
  formatPhoneNumber,
};
