const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * GET /api/debts
 * Get all pending debts for a user
 */
router.get('/debts', async (req, res) => {
  try {
    const { phoneNumber } = req.query;

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
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get all debts for this user (pending only)
    const { data: debts, error } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', userData.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching debts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch debts',
      });
    }

    // Transform to frontend format
    const transformedDebts = debts.map(debt => ({
      id: debt.id,
      customerName: debt.customer_name,
      amount: parseFloat(debt.amount),
      phoneNumber: debt.phone_number,
      createdAt: debt.created_at,
      status: debt.status,
    }));

    res.status(200).json({
      success: true,
      debts: transformedDebts,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/debts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/debts
 * Add a new debt
 */
router.post('/debts', async (req, res) => {
  try {
    const { phoneNumber, customerName, amount, customerPhone } = req.body;

    if (!phoneNumber || !customerName || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Phone number, customer name, and amount required',
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
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Insert debt
    const { data: debt, error } = await supabase
      .from('debts')
      .insert([{
        user_id: userData.id,
        customer_name: customerName,
        amount: amount,
        phone_number: customerPhone || null,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding debt:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to add debt',
      });
    }

    console.log('✅ Debt added successfully:', debt.id);

    res.status(201).json({
      success: true,
      debt: {
        id: debt.id,
        customerName: debt.customer_name,
        amount: parseFloat(debt.amount),
        phoneNumber: debt.phone_number,
        createdAt: debt.created_at,
        status: debt.status,
      },
    });
  } catch (error) {
    console.error('❌ Error in POST /api/debts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * PUT /api/debts/:id/clear
 * Clear a debt (mark as paid)
 */
router.put('/debts/:id/clear', async (req, res) => {
  try {
    const { id } = req.params;
    const { phoneNumber } = req.body;

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
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update debt status
    const { data: debt, error } = await supabase
      .from('debts')
      .update({
        status: 'cleared',
        cleared_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userData.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error clearing debt:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to clear debt',
      });
    }

    if (!debt) {
      return res.status(404).json({
        success: false,
        message: 'Debt not found',
      });
    }

    console.log('✅ Debt cleared successfully:', debt.id);

    res.status(200).json({
      success: true,
      message: 'Debt cleared successfully',
    });
  } catch (error) {
    console.error('❌ Error in PUT /api/debts/:id/clear:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;
