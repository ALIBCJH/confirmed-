const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/sync/sales-summary
 * Save sales summary (totals) to cloud
 */
router.post('/sync/sales-summary', async (req, res) => {
  try {
    const { phoneNumber, salesSummary } = req.body;

    // Validation
    if (!phoneNumber || !salesSummary) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: phoneNumber and salesSummary required',
      });
    }

    // Check if Supabase is configured
    if (!supabase) {
      console.error('❌ Supabase not configured');
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Get user by phone number
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !userData) {
      console.error('❌ User not found:', phoneNumber);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log(`📥 Saving sales summary for user ${userData.id}`);

    // Upsert sales summary
    const { data, error } = await supabase
      .from('sales_summary')
      .upsert([{
        user_id: userData.id,
        todays_total: salesSummary.todaysTotal,
        total_sales: salesSummary.totalSales,
        cash_sales: salesSummary.cashSales,
        last_reset_date: salesSummary.lastResetDate,
        updated_at: new Date().toISOString(),
      }], {
        onConflict: 'user_id'
      })
      .select();

    if (error) {
      console.error('❌ Error saving sales summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save sales summary',
      });
    }

    console.log('✅ Sales summary saved successfully');
    res.status(200).json({
      success: true,
      data: data[0],
    });

  } catch (error) {
    console.error('❌ Error in /sync/sales-summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/sync/transaction
 * Save a single transaction (from M-Pesa notification)
 */
router.post('/sync/transaction', async (req, res) => {
  try {
    const { phoneNumber, transaction } = req.body;

    // Validation
    if (!phoneNumber || !transaction) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: phoneNumber and transaction required',
      });
    }

    // Check if Supabase is configured
    if (!supabase) {
      console.error('❌ Supabase not configured');
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Get user by phone number
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !userData) {
      console.error('❌ User not found:', phoneNumber);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log(`📥 Saving transaction for user ${userData.id}`);

    // Parse timestamp safely
    let timestampISO;
    try {
      if (transaction.timestamp) {
        timestampISO = new Date(transaction.timestamp).toISOString();
      } else {
        timestampISO = new Date().toISOString();
      }
    } catch (err) {
      console.error('❌ Invalid timestamp:', transaction.timestamp);
      timestampISO = new Date().toISOString();
    }

    // Insert transaction
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        id: transaction.id,
        user_id: userData.id,
        amount: transaction.amount,
        sender_name: transaction.senderName,
        transaction_code: transaction.transactionCode || null,
        phone_number: transaction.phoneNumber,
        timestamp: timestampISO,
        payment_method: transaction.type || 'mpesa',
        category: 'sales',
      }])
      .select();

    if (error) {
      // If duplicate key, ignore (transaction already exists)
      if (error.code === '23505') {
        console.log('ℹ️ Transaction already exists:', transaction.id);
        return res.status(200).json({
          success: true,
          message: 'Transaction already exists',
        });
      }
      
      console.error('❌ Error inserting transaction:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        message: 'Failed to save transaction',
        error: error.message,
      });
    }

    console.log('✅ Transaction saved successfully');
    res.status(201).json({
      success: true,
      data: data[0],
    });

  } catch (error) {
    console.error('❌ Error in /sync/transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/sync
 * Sync transactions from mobile device to Supabase
 * Requires authentication - each user's transactions are isolated
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { transactions } = req.body;
    const userId = req.user.userId; // Get from authenticated token

    // Validation
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: transactions array required',
      });
    }

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        syncedCount: 0,
        message: 'No transactions to sync',
      });
    }

    // Check if Supabase is configured
    if (!supabase) {
      console.error('❌ Supabase not configured');
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    console.log(`📥 Received ${transactions.length} transactions to sync for user ${userId}`);

    // Prepare transactions for upsert - add user_id for multi-tenancy
    const transactionsToUpsert = transactions.map(t => ({
      id: t.id,
      user_id: userId, // Associate with authenticated user - MULTI-TENANCY
      amount: t.amount,
      category: t.category,
      payment_method: t.payment_method,
      created_at: t.created_at,
      sender_name: t.sender_name || null,
      mpesa_code: t.mpesa_code || null,
      phone_number: t.phone_number || null,
      note: t.note || null,
      synced_at: new Date().toISOString(),
    }));

    // Upsert to Supabase (using id as conflict resolution)
    const { data, error} = await supabase
      .from('transactions')
      .upsert(transactionsToUpsert, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Database error',
        error: error,
      });
    }

    console.log(`✅ Successfully synced ${transactions.length} transactions for user ${userId}`);

    return res.status(200).json({
      success: true,
      syncedCount: transactions.length,
      message: 'Sync successful',
      data: data,
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/sync/transactions/:phoneNumber
 * Get transactions for a user by phone number (for initial sync after login)
 */
router.get('/sync/transactions/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number required',
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Get user by phone number
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !userData) {
      console.log('ℹ️ User not found:', phoneNumber);
      return res.status(200).json({
        success: true,
        transactions: [],
        count: 0,
      });
    }

    // Get transactions for this user
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userData.id)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('❌ Error fetching transactions:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    console.log(`✅ Fetched ${data.length} transactions for user ${phoneNumber}`);

    return res.status(200).json({
      success: true,
      count: data.length,
      transactions: data,
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/transactions
 * Get transactions for authenticated user only - MULTI-TENANCY
 * Optional query params: limit, offset
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    const userId = req.user.userId; // Get from authenticated token
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId) // Filter by user - CRITICAL FOR DATA ISOLATION
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching transactions:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      transactions: data,
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/transactions/stats
 * Get statistics for authenticated user only - MULTI-TENANCY
 */
router.get('/transactions/stats', authenticateToken, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    const userId = req.user.userId; // Get from authenticated token

    // Get total transactions for this user
    const { count: totalCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId); // Filter by user

    // Get today's transactions for this user
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayData, error: todayError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId) // Filter by user
      .gte('created_at', today.toISOString());

    if (todayError) {
      throw todayError;
    }

    const todaysTotal = todayData.reduce((sum, t) => sum + t.amount, 0);
    const todaysCount = todayData.length;

    // Get total sales for this user
    const { data: allData, error: allError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId); // Filter by user

    if (allError) {
      throw allError;
    }

    const totalSales = allData.reduce((sum, t) => sum + t.amount, 0);

    return res.status(200).json({
      success: true,
      stats: {
        totalTransactions: totalCount,
        totalSales: totalSales,
        todaysTransactions: todaysCount,
        todaysTotal: todaysTotal,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

module.exports = router;
