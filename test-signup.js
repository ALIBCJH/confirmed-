const axios = require('axios');

async function testSignup() {
  try {
    console.log('🧪 Testing signup endpoint...');
    console.log('URL: http://localhost:5000/api/auth/signup');
    
    const response = await axios.post('http://localhost:5000/api/auth/signup', {
      businessName: 'Test Business',
      phoneNumber: '254712345678',
      pin: '1234'
    });
    
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Error!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

testSignup();
