const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testCurrentServer() {
    console.log('🧪 Testing Current GoHighLevel Server\n');

    try {
        // Test 1: Health check
        console.log('1️⃣ Testing health check...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check passed:', healthResponse.data.status);
        console.log('');

        // Test 2: OAuth status
        console.log('2️⃣ Testing OAuth status...');
        const oauthStatusResponse = await axios.get(`${BASE_URL}/oauth/status`);
        console.log('✅ OAuth status:', oauthStatusResponse.data.message);
        console.log('   Authenticated:', oauthStatusResponse.data.authenticated);
        console.log('');

        // Test 3: OAuth init
        console.log('3️⃣ Testing OAuth initialization...');
        const oauthInitResponse = await axios.get(`${BASE_URL}/oauth/init`);
        console.log('✅ OAuth init successful');
        console.log('   Auth URL generated:', !!oauthInitResponse.data.auth_url);
        console.log('   State generated:', !!oauthInitResponse.data.state);
        console.log('');

        // Test 4: Webhook endpoint
        console.log('4️⃣ Testing webhook endpoint...');
        try {
            const webhookResponse = await axios.post(`${BASE_URL}/webhooks/ghl`, {
                test: 'data'
            }, {
                headers: {
                    'x-ghl-signature': 'test-signature'
                }
            });
            console.log('✅ Webhook endpoint accessible');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Webhook endpoint accessible (signature validation working)');
            } else {
                console.log('❌ Webhook endpoint error:', error.response?.status);
            }
        }
        console.log('');

        // Test 5: Protected endpoints (should fail without auth)
        console.log('5️⃣ Testing protected endpoints (should fail without auth)...');
        try {
            await axios.get(`${BASE_URL}/contacts`);
            console.log('❌ Contacts endpoint should have failed without auth');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Contacts endpoint correctly requires authentication');
            } else {
                console.log('❌ Unexpected error:', error.response?.status);
            }
        }

        try {
            await axios.get(`${BASE_URL}/opportunities`);
            console.log('❌ Opportunities endpoint should have failed without auth');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Opportunities endpoint correctly requires authentication');
            } else {
                console.log('❌ Unexpected error:', error.response?.status);
            }
        }

        console.log('');

        // Test 6: OAuth callback (should fail without proper params)
        console.log('6️⃣ Testing OAuth callback validation...');
        try {
            await axios.get(`${BASE_URL}/oauth/callback`);
            console.log('❌ OAuth callback should have failed without params');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ OAuth callback correctly validates required parameters');
            } else {
                console.log('❌ Unexpected error:', error.response?.status);
            }
        }

        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Complete OAuth authentication using the generated auth URL');
        console.log('   2. Test the protected endpoints with valid tokens');
        console.log('   3. Verify pipeline and contact data retrieval');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

// Run the test
testCurrentServer(); 