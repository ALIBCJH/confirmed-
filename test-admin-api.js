/**
 * Test script for Admin API
 * Usage: node test-admin-api.js
 */

require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:10000';
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY;

if (!ADMIN_KEY) {
  console.error('❌ ADMIN_SECRET_KEY not set in .env file');
  process.exit(1);
}

const headers = {
  'x-admin-key': ADMIN_KEY,
  'Content-Type': 'application/json',
};

async function testEndpoint(name, url) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`📡 URL: ${url}`);
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Failed');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Admin API Tests');
  console.log(`🔗 API URL: ${API_URL}`);
  console.log(`🔑 Admin Key: ${ADMIN_KEY.substring(0, 10)}...`);
  
  // Test 1: Overview
  await testEndpoint('Platform Overview', `${API_URL}/api/admin/overview`);
  
  // Test 2: Users List
  await testEndpoint('Users List (limit 5)', `${API_URL}/api/admin/users?limit=5`);
  
  // Test 3: Feature Usage
  await testEndpoint('Feature Usage', `${API_URL}/api/admin/feature-usage`);
  
  // Test 4: Growth Metrics
  await testEndpoint('Growth (7 days)', `${API_URL}/api/admin/growth?days=7`);
  
  // Test 5: Subscriptions
  await testEndpoint('Subscription Breakdown', `${API_URL}/api/admin/subscriptions`);
  
  console.log('\n✅ All tests completed!');
}

runTests().catch(console.error);
