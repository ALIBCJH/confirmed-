const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Only load .env in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // Bind to all network interfaces for Render

// Log environment status
console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
console.log('🔑 SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('🔑 SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✅ Set' : '❌ Missing');
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
const syncRoutes = require('./routes/sync');
const authRoutes = require('./routes/auth');
const mpesaRoutes = require('./routes/mpesa');
const debtsRoutes = require('./routes/debts');
const purchasesRoutes = require('./routes/purchases');

app.get('/', (req, res) => {
  res.json({
    message: 'CONFIRMED 2.0 Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        verify: 'GET /api/auth/verify',
        profile: 'GET /api/auth/profile',
      },
      sync: 'POST /api/sync',
      transactions: 'GET /api/transactions',
      stats: 'GET /api/transactions/stats',
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test Supabase connection
app.get('/api/test-connection', async (req, res) => {
  try {
    const supabase = require('./config/supabase');

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Supabase not configured. Please add SUPABASE_URL and SUPABASE_KEY to .env',
      });
    }

    // Try to query users table
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection error:', error);
      return res.status(500).json({
        success: false,
        message: 'Supabase connection failed',
        error: error.message,
      });
    }

    console.log('✅ Supabase connection successful');

    return res.status(200).json({
      success: true,
      message: 'Supabase connection successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Connection test error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Connection test failed',
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api', syncRoutes);
app.use('/api', debtsRoutes);
app.use('/api', purchasesRoutes);

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API: http://${HOST}:${PORT}`);
  console.log(`✅ Ready to accept connections`);
});

module.exports = app;
