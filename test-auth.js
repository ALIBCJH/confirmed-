const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

// Test data
const testUser = {
  businessName: 'Test Duka',
  phoneNumber: '254712345678',
  pin: '1234',
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
};

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  try {
    log.info('Testing health check endpoint...');
    const response = await axios.get(`${API_BASE_URL}/health`);
    
    if (response.status === 200) {
      log.success('Health check passed');
      console.log('  Response:', response.data);
      return true;
    }
  } catch (error) {
    log.error('Health check failed: ' + error.message);
    return false;
  }
}

/**
 * Test 2: Sign Up
 */
async function testSignup() {
  try {
    log.info('Testing signup endpoint...');
    const response = await axios.post(`${API_BASE_URL}/api/auth/signup`, testUser);
    
    if (response.data.success) {
      log.success('Signup successful');
      console.log('  User ID:', response.data.data.userId);
      console.log('  Business Name:', response.data.data.businessName);
      console.log('  Phone:', response.data.data.phoneNumber);
      console.log('  Token:', response.data.data.token.substring(0, 20) + '...');
      return response.data.data.token;
    } else {
      log.warn('Signup response: ' + response.data.message);
      return null;
    }
  } catch (error) {
    if (error.response?.status === 409) {
      log.warn('User already exists (this is expected if running multiple times)');
      return 'exists';
    }
    log.error('Signup failed: ' + (error.response?.data?.message || error.message));
    return null;
  }
}

/**
 * Test 3: Login
 */
async function testLogin() {
  try {
    log.info('Testing login endpoint...');
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      phoneNumber: testUser.phoneNumber,
      pin: testUser.pin,
    });
    
    if (response.data.success) {
      log.success('Login successful');
      console.log('  User ID:', response.data.data.userId);
      console.log('  Business Name:', response.data.data.businessName);
      console.log('  Subscription:', response.data.data.subscriptionStatus);
      console.log('  Token:', response.data.data.token.substring(0, 20) + '...');
      return response.data.data.token;
    }
  } catch (error) {
    log.error('Login failed: ' + (error.response?.data?.message || error.message));
    return null;
  }
}

/**
 * Test 4: Verify Token
 */
async function testVerifyToken(token) {
  try {
    log.info('Testing token verification...');
    const response = await axios.get(`${API_BASE_URL}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (response.data.success) {
      log.success('Token verification passed');
      console.log('  User data:', response.data.data);
      return true;
    }
  } catch (error) {
    log.error('Token verification failed: ' + (error.response?.data?.message || error.message));
    return false;
  }
}

/**
 * Test 5: Get Profile
 */
async function testGetProfile(token) {
  try {
    log.info('Testing get profile endpoint...');
    const response = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (response.data.success) {
      log.success('Get profile passed');
      console.log('  Profile data:', response.data.data);
      return true;
    }
  } catch (error) {
    log.error('Get profile failed: ' + (error.response?.data?.message || error.message));
    return false;
  }
}

/**
 * Test 6: Save Transaction to Supabase
 */
async function testSaveTransaction(token) {
  try {
    log.info('Testing transaction sync...');
    const mockTransaction = {
      transactions: [
        {
          id: 'test-' + Date.now(),
          amount: 500,
          category: 'Test Sale',
          payment_method: 'Cash',
          created_at: new Date().toISOString(),
          note: 'Test transaction from auth test',
        },
      ],
    };

    const response = await axios.post(
      `${API_BASE_URL}/api/sync`,
      mockTransaction,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    if (response.data.success) {
      log.success('Transaction saved to Supabase');
      console.log('  Synced count:', response.data.syncedCount);
      return true;
    }
  } catch (error) {
    log.error('Transaction sync failed: ' + (error.response?.data?.message || error.message));
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 CONFIRMED 2.0 - Authentication & Sync Tests');
  console.log('='.repeat(60) + '\n');

  let token = null;
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Health Check
  if (await testHealthCheck()) {
    testsPassed++;
  } else {
    testsFailed++;
    log.error('Server is not running. Start it with: npm run dev');
    return;
  }
  console.log('');

  // Test 2: Signup
  token = await testSignup();
  if (token && token !== 'exists') {
    testsPassed++;
  } else if (token === 'exists') {
    log.info('Skipping signup test (user exists)');
  } else {
    testsFailed++;
  }
  console.log('');

  // Test 3: Login (this should always work)
  token = await testLogin();
  if (token) {
    testsPassed++;
  } else {
    testsFailed++;
    log.error('Cannot proceed without valid token');
    return;
  }
  console.log('');

  // Test 4: Verify Token
  if (await testVerifyToken(token)) {
    testsPassed++;
  } else {
    testsFailed++;
  }
  console.log('');

  // Test 5: Get Profile
  if (await testGetProfile(token)) {
    testsPassed++;
  } else {
    testsFailed++;
  }
  console.log('');

  // Test 6: Save Transaction
  if (await testSaveTransaction(token)) {
    testsPassed++;
  } else {
    testsFailed++;
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   ${colors.green}Passed: ${testsPassed}${colors.reset}`);
  console.log(`   ${colors.red}Failed: ${testsFailed}${colors.reset}`);
  console.log('='.repeat(60) + '\n');

  if (testsFailed === 0) {
    log.success('All tests passed! 🎉');
    console.log('\n💡 Next steps:');
    console.log('   1. Check your Supabase dashboard to see the user and transaction');
    console.log('   2. Run the mobile app and test signup/login');
    console.log('   3. Test offline transaction sync\n');
  } else {
    log.error('Some tests failed. Check the errors above.');
  }
}

// Run tests
runTests().catch((error) => {
  log.error('Test suite error: ' + error.message);
  console.error(error);
});
