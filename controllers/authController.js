const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

/**
 * Generate JWT token
 */
const generateToken = (userId, phoneNumber) => {
  return jwt.sign(
    { userId, phoneNumber },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Sign Up Controller
 * POST /api/auth/signup
 */
const signup = async (req, res) => {
  try {
    const { businessName, phoneNumber, pin } = req.body;

    // Validation
    if (!businessName || !phoneNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Business name, phone number, and PIN are required',
      });
    }

    // Validate phone number format (Kenyan format)
    const phoneRegex = /^(254|0)[17]\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use 254XXXXXXXXX or 07XXXXXXXX',
      });
    }

    // Validate PIN (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be 4-6 digits',
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, phone_number')
      .eq('phone_number', phoneNumber)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered',
      });
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create user in Supabase (verified immediately)
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          business_name: businessName,
          phone_number: phoneNumber,
          pin: hashedPin,
          subscription_status: 'trial',
          is_verified: true,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Supabase insert error:', insertError);
      return res.status(500).json({
        success: false,
        message: insertError.message || 'Failed to create account',
      });
    }

    // Generate JWT token
    const token = generateToken(newUser.id, newUser.phone_number);

    console.log(`✅ New user registered: ${phoneNumber}`);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now log in.',
      data: {
        userId: newUser.id,
        businessName: newUser.business_name,
        phoneNumber: newUser.phone_number,
        subscriptionStatus: newUser.subscription_status,
        token,
      },
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Login Controller
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { phoneNumber, pin } = req.body;

    // Validation
    if (!phoneNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and PIN are required',
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Find user by phone number
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (fetchError || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or PIN',
      });
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, user.pin);

    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or PIN',
      });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT token
    const token = generateToken(user.id, user.phone_number);

    console.log(`✅ User logged in: ${phoneNumber}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.id,
        businessName: user.business_name,
        phoneNumber: user.phone_number,
        subscriptionStatus: user.subscription_status,
        signupDate: user.created_at,
        token,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Verify Token Controller (for protected routes)
 * GET /api/auth/verify
 */
const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user details
    const { data: user, error } = await supabase
      .from('users')
      .select('id, business_name, phone_number, subscription_status, created_at')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        businessName: user.business_name,
        phoneNumber: user.phone_number,
        subscriptionStatus: user.subscription_status,
        signupDate: user.created_at,
      },
    });
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

/**
 * Get User Profile
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, business_name, phone_number, subscription_status, created_at, last_login')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

module.exports = {
  signup,
  login,
  verifyToken,
  getProfile,
};
