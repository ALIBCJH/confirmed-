const { initiateSTKPush, handleCallback } = require('../services/mpesaService');
const supabase = require('../config/supabase');

/**
 * Initiate subscription payment
 * POST /api/mpesa/subscribe
 */
const initiateSubscription = async (req, res) => {
  try {
    const { phoneNumber, planId } = req.body;

    // Validation
    if (!phoneNumber || !planId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and plan ID are required',
      });
    }

    // Find user by phone number
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Define plan amounts
    const planAmounts = {
      basic: 30,
      premium: 50,
    };

    const amount = planAmounts[planId];
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan ID',
      });
    }

    // Initiate STK Push
    const result = await initiateSTKPush(
      phoneNumber,
      amount,
      `SUB-${planId.toUpperCase()}`,
      `Subscription: ${planId} plan`
    );

    if (result.success) {
      // Store transaction in database
      const { data: transaction, error } = await supabase
        .from('mpesa_transactions')
        .insert([
          {
            user_id: user.id,
            merchant_request_id: result.data.merchantRequestId,
            checkout_request_id: result.data.checkoutRequestId,
            phone_number: phoneNumber,
            amount: amount,
            account_reference: planId, // Store planId for subscription update
            transaction_desc: `Subscription: ${planId} plan`,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('❌ Error storing transaction:', error);
      }

      // TEST MODE: Auto-complete payment after 5 seconds
      if (result.data.checkoutRequestId.startsWith('TEST_CO_')) {
        console.log('⚠️ TEST MODE: Auto-completing payment in 5 seconds...');
        setTimeout(async () => {
          try {
            await supabase
              .from('mpesa_transactions')
              .update({
                status: 'completed',
                mpesa_receipt_number: `TEST_${Date.now()}`,
                transaction_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('checkout_request_id', result.data.checkoutRequestId);

            // Update user subscription
            await supabase
              .from('users')
              .update({
                subscription_status: planId,
              })
              .eq('id', user.id);

            console.log('✅ TEST MODE: Payment auto-completed');
          } catch (err) {
            console.error('❌ TEST MODE: Auto-complete error:', err);
          }
        }, 5000);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment request sent to your phone',
        data: {
          checkoutRequestId: result.data.checkoutRequestId,
          customerMessage: result.data.customerMessage,
        },
      });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Subscription payment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process payment',
    });
  }
};

/**
 * M-Pesa callback handler
 * POST /api/mpesa/callback
 */
const mpesaCallback = async (req, res) => {
  try {
    console.log('📱 M-Pesa callback received:', JSON.stringify(req.body, null, 2));

    const result = handleCallback(req.body);

    if (result.success) {
      // Get transaction to find user and plan
      const { data: transaction } = await supabase
        .from('mpesa_transactions')
        .select('user_id, account_reference')
        .eq('checkout_request_id', result.checkoutRequestId)
        .single();

      // Update transaction status in database
      const { error } = await supabase
        .from('mpesa_transactions')
        .update({
          status: 'completed',
          mpesa_receipt_number: result.mpesaReceiptNumber,
          transaction_date: result.transactionDate,
          updated_at: new Date().toISOString(),
        })
        .eq('checkout_request_id', result.checkoutRequestId);

      if (error) {
        console.error('❌ Error updating transaction:', error);
      }

      // Update user subscription status
      if (transaction && transaction.user_id && transaction.account_reference) {
        const { error: subError } = await supabase
          .from('users')
          .update({
            subscription_status: transaction.account_reference,
          })
          .eq('id', transaction.user_id);

        if (subError) {
          console.error('❌ Error updating subscription:', subError);
        } else {
          console.log(`✅ User ${transaction.user_id} upgraded to ${transaction.account_reference}`);
        }
      }

      console.log('✅ Payment confirmed and subscription updated');
    } else {
      // Update transaction as failed
      await supabase
        .from('mpesa_transactions')
        .update({
          status: 'failed',
          result_desc: result.resultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq('checkout_request_id', result.checkoutRequestId);
    }

    // Always respond with success to M-Pesa
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Success',
    });
  } catch (error) {
    console.error('❌ Callback handler error:', error);
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Success',
    });
  }
};

/**
 * Check payment status
 * GET /api/mpesa/status/:checkoutRequestId
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    const { data: transaction, error } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (error || !transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    return res.status(200).json({
      success: true,
      status: transaction.status,
      mpesa_receipt_number: transaction.mpesa_receipt_number,
      amount: transaction.amount,
      transaction_date: transaction.transaction_date,
      result_desc: transaction.result_desc,
    });
  } catch (error) {
    console.error('❌ Status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
    });
  }
};

module.exports = {
  initiateSubscription,
  mpesaCallback,
  checkPaymentStatus,
};
