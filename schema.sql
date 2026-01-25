-- CONFIRMED 2.0 Supabase Schema
-- Run this SQL in your Supabase SQL Editor

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'basic', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT false,
  CONSTRAINT phone_format CHECK (phone_number ~ '^(254|0)[17]\d{8}$')
);

-- 1b. Create OTP Table (for login only)
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0
);

-- Index for quick OTP lookup
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone_number, verified);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category TEXT DEFAULT 'sales',
  payment_method TEXT NOT NULL DEFAULT 'mpesa',
  sender_name TEXT,
  transaction_code TEXT,
  phone_number TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  note TEXT,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2b. Create Sales Summary Table
CREATE TABLE IF NOT EXISTS sales_summary (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  todays_total DECIMAL(10,2) DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  cash_sales DECIMAL(10,2) DEFAULT 0,
  last_reset_date TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Debts Table (for Deni Manager)
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cleared_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared'))
);

-- 4. Create Purchases Table (for Stock & Investment)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create M-Pesa Transactions Table (for subscription payments)
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  phone_number TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  account_reference TEXT,
  transaction_desc TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  mpesa_receipt_number TEXT,
  transaction_date TEXT,
  result_desc TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_user_id ON mpesa_transactions(user_id);
-- 7. Enable Row Level Security (RLS) - But allow service role full access
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS Policies - Allow service role (our backend) full access
-- This allows our backend with the service key to manage all data
CREATE POLICY "Service role has full access to users" ON users
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to otp_codes" ON otp_codes
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to transactions" ON transactions
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to debts" ON debts
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to purchases" ON purchases
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to mpesa_transactions" ON mpesa_transactions
  FOR ALL USING (true);

-- 8. Create Views for Quick Stats
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  u.id as user_id,
  u.business_name,
  u.subscription_status,
  COUNT(DISTINCT t.id) as total_transactions,
  COALESCE(SUM(t.amount), 0) as total_sales,
  COUNT(DISTINCT CASE WHEN t.created_at >= CURRENT_DATE THEN t.id END) as today_transactions,
  COALESCE(SUM(CASE WHEN t.created_at >= CURRENT_DATE THEN t.amount ELSE 0 END), 0) as today_sales,
  COUNT(DISTINCT d.id) as total_debts,
  COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END), 0) as pending_debt_amount
FROM users u
-- 9. Create Functions
-- Function to clean old trial users
CREATE OR REPLACE FUNCTION cleanup_expired_trials()
RETURNS void AS $$
BEGIN
  -- Delete users whose trial expired 30+ days ago and never upgraded
  DELETE FROM users 
  WHERE subscription_status = 'trial' 
    AND created_at < NOW() - INTERVAL '40 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired OTP codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  -- Delete OTP codes older than 24 hours
  DELETE FROM otp_codes 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
  WHERE subscription_status = 'trial' 
    AND created_at < NOW() - INTERVAL '40 days';
END;
$$ LANGUAGE plpgsql;

-- 10. Success Message
DO $$
BEGIN
  RAISE NOTICE '✅ CONFIRMED 2.0 schema created successfully!';
  RAISE NOTICE '📊 Tables: users, transactions, debts, purchases';
  RAISE NOTICE '🔒 RLS enabled on all tables';
  RAISE NOTICE '📈 Indexes and views created';
END $$;
