const supabase = require('../config/supabase');

/**
 * Generate a 6-digit OTP code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via SMS (placeholder - integrate with Africa's Talking or similar)
 * For now, we'll just log it to console in development
 */
async function sendOTPSMS(phoneNumber, otpCode) {
  // TODO: Integrate with SMS provider (Africa's Talking, Twilio, etc.)
  console.log(`📱 SMS to ${phoneNumber}: Your CONFIRMED OTP is: ${otpCode}. Valid for 10 minutes.`);
  
  // In production, you would call an SMS API here:
  // const africasTalking = require('africastalking')(config);
  // await africasTalking.SMS.send({ to: [phoneNumber], message: `Your OTP is ${otpCode}` });
  
  return { success: true };
}

/**
 * Create and send OTP for login
 * @param {string} phoneNumber - User's phone number
 */
async function createOTP(phoneNumber) {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('phone_number')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Valid for 10 minutes

    // Invalidate any existing unverified OTPs for this phone
    await supabase
      .from('otp_codes')
      .update({ verified: true }) // Mark as used
      .eq('phone_number', phoneNumber)
      .eq('verified', false);

    // Store OTP in database
    const { data, error } = await supabase
      .from('otp_codes')
      .insert([
        {
          phone_number: phoneNumber,
          otp_code: otpCode,
          expires_at: expiresAt.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error storing OTP:', error);
      throw error;
    }

    // Send OTP via SMS
    await sendOTPSMS(phoneNumber, otpCode);

    console.log(`✅ OTP created for ${phoneNumber}: ${otpCode}`);

    return {
      success: true,
      otpId: data.id,
      expiresAt: expiresAt,
      // In development, return OTP for testing. Remove in production!
      ...(process.env.NODE_ENV === 'development' && { otp: otpCode }),
    };
  } catch (error) {
    console.error('❌ Error creating OTP:', error);
    throw error;
  }
}

/**
 * Verify OTP code for login
 * @param {string} phoneNumber - User's phone number
 * @param {string} otpCode - The OTP code to verify
 */
async function verifyOTP(phoneNumber, otpCode) {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Find the OTP
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return {
        success: false,
        message: 'No valid OTP found. Please request a new one.',
      };
    }

    // Check if OTP has expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    
    if (now > expiresAt) {
      return {
        success: false,
        message: 'OTP has expired. Please request a new one.',
      };
    }

    // Check attempts (max 5)
    if (otpRecord.attempts >= 5) {
      return {
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.',
      };
    }

    // Verify OTP code
    if (otpRecord.otp_code !== otpCode) {
      // Increment attempts
      await supabase
        .from('otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      return {
        success: false,
        message: 'Invalid OTP code.',
        attemptsLeft: 5 - (otpRecord.attempts + 1),
      };
    }

    // Mark OTP as verified
    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    console.log(`✅ OTP verified for ${phoneNumber}`);

    return {
      success: true,
      message: 'OTP verified successfully',
    };
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    throw error;
  }
}

module.exports = {
  createOTP,
  verifyOTP,
  generateOTP, // For testing
};