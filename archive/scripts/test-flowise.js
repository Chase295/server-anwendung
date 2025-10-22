const axios = require('axios');

// Dein Flowise-Script hier einfügen:
const API_URL = "https://flowise.local.chase295.de/api/v1/prediction/203c3495-cacc-408f-b9ea-8df04d44817c";
const headers = {"Authorization": "Bearer dkSjdaLRLVD8d9YUyuppzvDBB3HUujvQloEf5vtdcIc"};

console.log('🧪 Testing Flowise connection...\n');
console.log('API URL:', API_URL);
console.log('Auth Token:', headers.Authorization.substring(0, 20) + '...\n');

const testPayload = {
  question: "test",
};

const startTime = Date.now();

// Test 1: Mit Default Axios
console.log('Test 1: Default Axios...');
axios.post(API_URL, testPayload, { 
  headers,
  timeout: 10000 
})
  .then(response => {
    const duration = Date.now() - startTime;
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Duration:', duration + 'ms');
    console.log('Response preview:', JSON.stringify(response.data).substring(0, 200));
  })
  .catch(error => {
    const duration = Date.now() - startTime;
    console.log('❌ Error!');
    console.log('Duration:', duration + 'ms');
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  });

// Test 2: Mit SSL-Bypass (falls selbst-signiertes Zertifikat)
setTimeout(() => {
  console.log('\n\nTest 2: Mit SSL-Bypass...');
  const https = require('https');
  const agent = new https.Agent({  
    rejectUnauthorized: false
  });

  const startTime2 = Date.now();
  
  axios.post(API_URL, testPayload, { 
    headers,
    timeout: 10000,
    httpsAgent: agent
  })
    .then(response => {
      const duration = Date.now() - startTime2;
      console.log('✅ Success with SSL bypass!');
      console.log('Status:', response.status);
      console.log('Duration:', duration + 'ms');
      console.log('Response preview:', JSON.stringify(response.data).substring(0, 200));
    })
    .catch(error => {
      const duration = Date.now() - startTime2;
      console.log('❌ Error with SSL bypass!');
      console.log('Duration:', duration + 'ms');
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
      }
    });
}, 2000);

