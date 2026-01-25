const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * GET /api/purchases
 * Get all purchases for a user with optional date filtering
 */
router.get('/purchases', async (req, res) => {
  try {
    const { phoneNumber, period } = req.query;

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

    // Calculate date range based on period
    let dateFilter = null;
    const now = new Date();
    
    if (period === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = today.toISOString();
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = weekAgo.toISOString();
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = monthAgo.toISOString();
    }

    // Build query
    let query = supabase
      .from('purchases')
      .select(`
        *,
        purchase_items (*)
      `)
      .eq('user_id', userData.id);

    // Apply date filter if specified
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data: purchases, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching purchases:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch purchases',
      });
    }

    // Transform to frontend format
    const transformedPurchases = purchases.map(purchase => ({
      id: purchase.id,
      totalAmount: parseFloat(purchase.total_amount),
      notes: purchase.notes,
      createdAt: purchase.created_at,
      items: purchase.purchase_items.map(item => ({
        id: item.id,
        itemName: item.item_name,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        unit: item.unit,
      })),
    }));

    res.status(200).json({
      success: true,
      purchases: transformedPurchases,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/purchases
 * Add a new purchase with items
 */
router.post('/purchases', async (req, res) => {
  try {
    const { phoneNumber, items, notes } = req.body;

    if (!phoneNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and items array required',
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

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

    // Insert purchase header
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert([{
        user_id: userData.id,
        total_amount: totalAmount,
        notes: notes || null,
      }])
      .select()
      .single();

    if (purchaseError) {
      console.error('❌ Error adding purchase:', purchaseError);
      return res.status(500).json({
        success: false,
        message: 'Failed to add purchase',
      });
    }

    // Insert purchase items
    const purchaseItems = items.map(item => ({
      purchase_id: purchase.id,
      item_name: item.itemName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      unit: item.unit || 'pcs',
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('purchase_items')
      .insert(purchaseItems)
      .select();

    if (itemsError) {
      console.error('❌ Error adding purchase items:', itemsError);
      // Rollback: delete the purchase
      await supabase.from('purchases').delete().eq('id', purchase.id);
      return res.status(500).json({
        success: false,
        message: 'Failed to add purchase items',
      });
    }

    console.log('✅ Purchase added successfully:', purchase.id);

    res.status(201).json({
      success: true,
      purchase: {
        id: purchase.id,
        totalAmount: parseFloat(purchase.total_amount),
        notes: purchase.notes,
        createdAt: purchase.created_at,
        items: insertedItems.map(item => ({
          id: item.id,
          itemName: item.item_name,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unit_price),
          totalPrice: parseFloat(item.total_price),
          unit: item.unit,
        })),
      },
    });
  } catch (error) {
    console.error('❌ Error in POST /api/purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/purchases/stats
 * Get purchase statistics with optional date filtering
 */
router.get('/purchases/stats', async (req, res) => {
  try {
    const { phoneNumber, period } = req.query;

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

    // Calculate date range based on period
    let dateFilter = null;
    const now = new Date();
    
    if (period === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = today.toISOString();
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = weekAgo.toISOString();
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = monthAgo.toISOString();
    }

    // Build query
    let query = supabase
      .from('purchases')
      .select('total_amount')
      .eq('user_id', userData.id);

    // Apply date filter if specified
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data: purchases, error } = await query;

    if (error) {
      console.error('❌ Error fetching purchase stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch stats',
      });
    }

    const total = purchases.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);

    res.status(200).json({
      success: true,
      stats: {
        todaysTotal: total,
        todaysCount: purchases.length,
      },
    });
  } catch (error) {
    console.error('❌ Error in GET /api/purchases/stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;
