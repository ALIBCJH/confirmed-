const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * Simple admin authentication middleware
 * In production, use proper admin authentication
 */
const authenticateAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Invalid admin key',
    });
  }
  
  next();
};

/**
 * GET /api/admin/overview
 * Get high-level overview of the entire platform
 */
router.get('/overview', authenticateAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Active users (logged in within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_login', sevenDaysAgo.toISOString());

    // New users (signed up in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: newUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Total transactions
    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    // Total transaction volume
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('amount');
    
    const totalVolume = allTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    const { data: todayData } = await supabase
      .from('transactions')
      .select('amount')
      .gte('created_at', today.toISOString());
    
    const todayVolume = todayData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Total purchases
    const { count: totalPurchases } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true });

    // Total debts
    const { count: totalDebts } = await supabase
      .from('debts')
      .select('*', { count: 'exact', head: true });

    const { data: allDebts } = await supabase
      .from('debts')
      .select('amount, amount_paid');
    
    const totalDebtAmount = allDebts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
    const totalDebtPaid = allDebts?.reduce((sum, d) => sum + (d.amount_paid || 0), 0) || 0;
    const totalDebtOutstanding = totalDebtAmount - totalDebtPaid;

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers || 0,
          active: activeUsers || 0,
          new: newUsers || 0,
          activeRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
        },
        transactions: {
          total: totalTransactions || 0,
          volume: totalVolume,
          today: todayTransactions || 0,
          todayVolume: todayVolume,
          avgPerTransaction: totalTransactions > 0 ? (totalVolume / totalTransactions).toFixed(2) : 0,
        },
        purchases: {
          total: totalPurchases || 0,
        },
        debts: {
          total: totalDebts || 0,
          totalAmount: totalDebtAmount,
          totalPaid: totalDebtPaid,
          outstanding: totalDebtOutstanding,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Error in /admin/overview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/users
 * Get list of all users with their activity
 */
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'created_at';
    const order = req.query.order || 'desc';

    // Get users
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order(sortBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Enrich with transaction counts
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      const { count: transactionCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id);

      const totalVolume = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      const { count: purchaseCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('user_phone', user.phone_number);

      const { count: debtCount } = await supabase
        .from('debts')
        .select('*', { count: 'exact', head: true })
        .eq('user_phone', user.phone_number);

      return {
        id: user.id,
        phoneNumber: user.phone_number,
        businessName: user.business_name,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        activity: {
          transactions: transactionCount || 0,
          transactionVolume: totalVolume,
          purchases: purchaseCount || 0,
          debts: debtCount || 0,
        },
      };
    }));

    return res.status(200).json({
      success: true,
      count: enrichedUsers.length,
      users: enrichedUsers,
    });
  } catch (error) {
    console.error('❌ Error in /admin/users:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed information about a specific user
 */
router.get('/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    const { userId } = req.params;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get transactions
    const { data: transactions, count: transactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const totalVolume = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Get purchases
    const { data: purchases, count: purchaseCount } = await supabase
      .from('purchases')
      .select('*', { count: 'exact' })
      .eq('user_phone', user.phone_number)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get debts
    const { data: debts, count: debtCount } = await supabase
      .from('debts')
      .select('*', { count: 'exact' })
      .eq('user_phone', user.phone_number)
      .order('created_at', { ascending: false })
      .limit(10);

    const totalDebtAmount = debts?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
    const totalDebtPaid = debts?.reduce((sum, d) => sum + (d.amount_paid || 0), 0) || 0;

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        businessName: user.business_name,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
      activity: {
        transactions: {
          total: transactionCount || 0,
          volume: totalVolume,
          recent: transactions || [],
        },
        purchases: {
          total: purchaseCount || 0,
          recent: purchases || [],
        },
        debts: {
          total: debtCount || 0,
          totalAmount: totalDebtAmount,
          totalPaid: totalDebtPaid,
          outstanding: totalDebtAmount - totalDebtPaid,
          recent: debts || [],
        },
      },
    });
  } catch (error) {
    console.error('❌ Error in /admin/users/:userId:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/feature-usage
 * Get usage statistics for different features
 */
router.get('/feature-usage', authenticateAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Users with transactions (M-Pesa tracking)
    const { data: usersWithTransactions } = await supabase
      .from('transactions')
      .select('user_id')
      .not('user_id', 'is', null);
    
    const uniqueTransactionUsers = new Set(usersWithTransactions?.map(t => t.user_id) || []).size;

    // Users with purchases (Cash sales tracking)
    const { data: usersWithPurchases } = await supabase
      .from('purchases')
      .select('user_phone');
    
    const uniquePurchaseUsers = new Set(usersWithPurchases?.map(p => p.user_phone) || []).size;

    // Users with debts (Debt management)
    const { data: usersWithDebts } = await supabase
      .from('debts')
      .select('user_phone');
    
    const uniqueDebtUsers = new Set(usersWithDebts?.map(d => d.user_phone) || []).size;

    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Payment method breakdown
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('payment_method');
    
    const paymentMethods = {};
    allTransactions?.forEach(t => {
      const method = t.payment_method || 'unknown';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        features: {
          mpesaTracking: {
            users: uniqueTransactionUsers,
            percentage: totalUsers > 0 ? ((uniqueTransactionUsers / totalUsers) * 100).toFixed(1) : 0,
          },
          cashSales: {
            users: uniquePurchaseUsers,
            percentage: totalUsers > 0 ? ((uniquePurchaseUsers / totalUsers) * 100).toFixed(1) : 0,
          },
          debtManagement: {
            users: uniqueDebtUsers,
            percentage: totalUsers > 0 ? ((uniqueDebtUsers / totalUsers) * 100).toFixed(1) : 0,
          },
        },
        paymentMethods: paymentMethods,
      },
    });
  } catch (error) {
    console.error('❌ Error in /admin/feature-usage:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/growth
 * Get growth metrics over time
 */
router.get('/growth', authenticateAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    const days = parseInt(req.query.days) || 30;

    // Get user signups by day
    const { data: users } = await supabase
      .from('users')
      .select('created_at')
      .order('created_at', { ascending: true });

    // Get transactions by day
    const { data: transactions } = await supabase
      .from('transactions')
      .select('created_at, amount')
      .order('created_at', { ascending: true });

    // Group by day
    const dailySignups = {};
    const dailyTransactions = {};
    const dailyVolume = {};

    users?.forEach(user => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      dailySignups[date] = (dailySignups[date] || 0) + 1;
    });

    transactions?.forEach(txn => {
      const date = new Date(txn.created_at).toISOString().split('T')[0];
      dailyTransactions[date] = (dailyTransactions[date] || 0) + 1;
      dailyVolume[date] = (dailyVolume[date] || 0) + (txn.amount || 0);
    });

    // Get last N days
    const growthData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      growthData.push({
        date: dateStr,
        signups: dailySignups[dateStr] || 0,
        transactions: dailyTransactions[dateStr] || 0,
        volume: dailyVolume[dateStr] || 0,
      });
    }

    return res.status(200).json({
      success: true,
      period: `${days} days`,
      data: growthData,
    });
  } catch (error) {
    console.error('❌ Error in /admin/growth:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/subscriptions
 * Get subscription tier breakdown
 */
router.get('/subscriptions', authenticateAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured',
      });
    }

    const { data: users } = await supabase
      .from('users')
      .select('subscription_tier');

    const tiers = {};
    users?.forEach(user => {
      const tier = user.subscription_tier || 'trial';
      tiers[tier] = (tiers[tier] || 0) + 1;
    });

    const total = users?.length || 0;

    return res.status(200).json({
      success: true,
      data: {
        total: total,
        tiers: Object.keys(tiers).map(tier => ({
          tier: tier,
          count: tiers[tier],
          percentage: total > 0 ? ((tiers[tier] / total) * 100).toFixed(1) : 0,
        })),
      },
    });
  } catch (error) {
    console.error('❌ Error in /admin/subscriptions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

module.exports = router;
