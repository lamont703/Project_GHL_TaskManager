#!/usr/bin/env node

/**
 * Test script for the new pipeline tasks integration
 * This script tests the new endpoints we added to the main server
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testIntegration() {
    console.log('🧪 Testing Pipeline Tasks Integration...\n');
    
    try {
        // Test 1: Check if server is running
        console.log('1️⃣ Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Server is running:', healthResponse.data);
        
        // Test 2: Check OAuth status
        console.log('\n2️⃣ Testing OAuth status...');
        try {
            const oauthResponse = await axios.get(`${BASE_URL}/oauth/status`);
            console.log('✅ OAuth status:', oauthResponse.data);
        } catch (error) {
            console.log('⚠️ OAuth not authenticated:', error.response?.data?.message || error.message);
        }
        
        // Test 3: Test the new rich pipeline endpoint
        console.log('\n3️⃣ Testing new rich pipeline endpoint...');
        try {
            const pipelineResponse = await axios.get(`${BASE_URL}/pipeline-tasks-rich`);
            console.log('✅ Rich pipeline endpoint response:');
            console.log(`   - Success: ${pipelineResponse.data.success}`);
            console.log(`   - Pipeline: ${pipelineResponse.data.pipeline_name}`);
            console.log(`   - Opportunities: ${pipelineResponse.data.opportunities_count}`);
            console.log(`   - Tasks: ${pipelineResponse.data.tasks_count}`);
            console.log(`   - Source: ${pipelineResponse.data.source}`);
            console.log(`   - Method: ${pipelineResponse.data.method}`);
            
            if (pipelineResponse.data.tasks && pipelineResponse.data.tasks.length > 0) {
                const firstTask = pipelineResponse.data.tasks[0];
                console.log('\n   📋 Sample task data:');
                console.log(`   - Title: ${firstTask.title || firstTask.name}`);
                console.log(`   - Opportunity: ${firstTask.opportunity_title || 'N/A'}`);
                console.log(`   - Stage: ${firstTask.opportunity_stage || 'N/A'}`);
                console.log(`   - Value: $${firstTask.opportunity_value || 'N/A'}`);
            }
            
        } catch (error) {
            console.log('❌ Rich pipeline endpoint failed:', error.response?.data?.error || error.message);
        }
        
        // Test 4: Test the enhanced tasks endpoint
        console.log('\n4️⃣ Testing enhanced tasks endpoint...');
        try {
            const tasksResponse = await axios.get(`${BASE_URL}/tasks`);
            console.log('✅ Enhanced tasks endpoint response:');
            console.log(`   - Success: ${tasksResponse.data.success}`);
            console.log(`   - Tasks: ${tasksResponse.data.tasks_count}`);
            console.log(`   - Source: ${tasksResponse.data.source}`);
            console.log(`   - Method: ${tasksResponse.data.method}`);
            
        } catch (error) {
            console.log('❌ Enhanced tasks endpoint failed:', error.response?.data?.error || error.message);
        }
        
        console.log('\n🎉 Integration test completed!');
        console.log('\n📋 Next steps:');
        console.log('1. Open dashboard.html in your browser');
        console.log('2. Click "🔄 Refresh Pipeline" button');
        console.log('3. Check the console for rich pipeline data');
        console.log('4. Verify tasks are grouped by user with opportunity context');
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure your server is running: npm start');
        console.log('2. Check if you have valid OAuth tokens');
        console.log('3. Verify your GoHighLevel API credentials');
    }
}

// Run the test
if (require.main === module) {
    testIntegration();
}

module.exports = { testIntegration }; 