#!/usr/bin/env node

const axios = require('axios');

// Configuration
const SERVER_URL = 'http://127.0.0.1:3000';

// Target pipeline configuration
const TARGET_PIPELINE = {
    name: 'Client Software Development Pipeline',
    id: 'uR2CMkTiwqoUOYuf8oGR'
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check server health
async function checkServerHealth() {
    try {
        const response = await axios.get(`${SERVER_URL}/health`);
        return response.data.status === 'healthy';
    } catch (error) {
        return false;
    }
}

// Get OAuth status
async function getOAuthStatus() {
    try {
        const response = await axios.get(`${SERVER_URL}/oauth/status`);
        return response.data;
    } catch (error) {
        throw new Error(`Failed to get OAuth status: ${error.response?.data?.message || error.message}`);
    }
}

// Get all pipelines
async function getPipelines() {
    try {
        const response = await axios.get(`${SERVER_URL}/pipelines`);
        return response.data;
    } catch (error) {
        throw new Error(`Failed to get pipelines: ${error.response?.data?.error || error.message}`);
    }
}

// Get specific pipeline by ID
async function getPipelineById(pipelineId) {
    try {
        const response = await axios.get(`${SERVER_URL}/pipelines/${pipelineId}`);
        return response.data;
    } catch (error) {
        throw new Error(`Failed to get pipeline ${pipelineId}: ${error.response?.data?.error || error.message}`);
    }
}

// Filter pipelines to find target pipeline
function findTargetPipeline(pipelinesData) {
    // Handle nested structure: pipelines.pipelines
    const pipelines = pipelinesData.pipelines?.pipelines || pipelinesData.pipelines || [];
    
    if (!pipelines || pipelines.length === 0) {
        return null;
    }
    
    // First try to find by exact name match
    let targetPipeline = pipelines.find(p => 
        p.name === TARGET_PIPELINE.name || 
        p.id === TARGET_PIPELINE.id
    );
    
    // If not found by exact match, try partial name match
    if (!targetPipeline) {
        targetPipeline = pipelines.find(p => 
            p.name.toLowerCase().includes('client software development') ||
            p.name.toLowerCase().includes('software development')
        );
    }
    
    return targetPipeline;
}

// Display target pipeline information
function displayTargetPipeline(pipeline, locationId, companyId) {
    log('\n🎯 TARGET PIPELINE: Client Software Development Pipeline', 'bright');
    log('='.repeat(60), 'cyan');
    
    if (!pipeline) {
        log('❌ Target pipeline not found', 'red');
        log('💡 Available pipelines:', 'yellow');
        return false;
    }
    
    log(`📍 Location ID: ${locationId}`, 'blue');
    log(`🏢 Company ID: ${companyId || 'N/A'}`, 'blue');
    log(`📋 Pipeline ID: ${pipeline.id}`, 'cyan');
    log(`🔧 Pipeline Name: ${pipeline.name}`, 'bright');
    log(`📊 Total Stages: ${pipeline.stages?.length || 0}`, 'green');
    log('');
    
    if (pipeline.stages && pipeline.stages.length > 0) {
        log('📋 PIPELINE STAGES:', 'yellow');
        log('-'.repeat(40), 'cyan');
        
        pipeline.stages.forEach((stage, index) => {
            const stageNumber = (index + 1).toString().padStart(2, '0');
            log(`${stageNumber}. ${stage.name}`, 'reset');
            
            // Display additional stage details if available
            if (stage.id) {
                log(`    ID: ${stage.id}`, 'dim');
            }
            if (stage.order) {
                log(`    Order: ${stage.order}`, 'dim');
            }
        });
        
        log('');
        log(`📈 Pipeline Progress: ${pipeline.stages.length} stages configured`, 'green');
    } else {
        log('⚠️  No stages configured for this pipeline', 'yellow');
    }
    
    // Display additional pipeline metadata if available
    if (pipeline.createdAt) {
        log(`📅 Created: ${new Date(pipeline.createdAt).toLocaleDateString()}`, 'blue');
    }
    if (pipeline.updatedAt) {
        log(`🔄 Updated: ${new Date(pipeline.updatedAt).toLocaleDateString()}`, 'blue');
    }
    
    return true;
}

// Display all pipelines (for comparison)
function displayAllPipelines(pipelinesData) {
    log('\n📊 ALL AVAILABLE PIPELINES', 'bright');
    log('='.repeat(50), 'cyan');
    
    const pipelines = pipelinesData.pipelines?.pipelines || pipelinesData.pipelines || [];
    
    if (!pipelines || pipelines.length === 0) {
        log('❌ No pipelines found', 'red');
        return;
    }
    
    log(`📍 Location ID: ${pipelinesData.location_id}`, 'blue');
    log(`🏢 Company ID: ${pipelinesData.company_id || 'N/A'}`, 'blue');
    log(`📋 Total Pipelines: ${pipelines.length}`, 'green');
    log('');
    
    pipelines.forEach((pipeline, index) => {
        const isTarget = pipeline.id === TARGET_PIPELINE.id || 
                        pipeline.name === TARGET_PIPELINE.name;
        
        const statusIcon = isTarget ? '🎯' : '📋';
        const nameColor = isTarget ? 'bright' : 'reset';
        
        log(`${statusIcon} ${index + 1}. ${pipeline.name}`, nameColor);
        log(`   ID: ${pipeline.id}`, 'cyan');
        log(`   Stages: ${pipeline.stages?.length || 0}`, 'yellow');
        
        if (isTarget) {
            log(`   ⭐ TARGET PIPELINE`, 'green');
        }
        log('');
    });
}

// Main function
async function main() {
    const showAll = process.argv.includes('--all') || process.argv.includes('-a');
    const showDetails = process.argv.includes('--details') || process.argv.includes('-d');
    
    log('🚀 GoHighLevel Pipeline Fetcher (Standalone)', 'bright');
    log('🎯 Targeting: Client Software Development Pipeline', 'cyan');
    log('Connecting to running server...\n', 'cyan');
    
    // Check if server is running
    log('1. Checking server health...', 'blue');
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
        log('❌ Server is not running or unhealthy', 'red');
        log('\n💡 Start the server with:', 'yellow');
        log('   node ghl-oauth-server.js', 'cyan');
        process.exit(1);
    }
    log('✅ Server is healthy\n', 'green');
    
    // Check OAuth status
    log('2. Checking authentication...', 'blue');
    try {
        const oauthStatus = await getOAuthStatus();
        if (!oauthStatus.authenticated) {
            log('❌ Not authenticated', 'red');
            log('\n💡 Authenticate by visiting:', 'yellow');
            log(`   ${SERVER_URL}/oauth/init`, 'cyan');
            process.exit(1);
        }
        log(`✅ Authenticated for location: ${oauthStatus.location_id}`, 'green');
        if (oauthStatus.expires_at) {
        log(`⏰ Expires: ${new Date(oauthStatus.expires_at).toLocaleString()}`, 'green');
        }
    } catch (error) {
        log(`❌ Authentication check failed: ${error.message}`, 'red');
        process.exit(1);
    }
    
    // Get pipelines
    log('\n3. Fetching pipelines...', 'blue');
    try {
        const pipelinesData = await getPipelines();
        
        // Find and display target pipeline
        const targetPipeline = findTargetPipeline(pipelinesData);
        const pipelineFound = displayTargetPipeline(
            targetPipeline, 
            pipelinesData.location_id, 
            pipelinesData.company_id
        );
        
        // Show all pipelines if requested or if target not found
        if (showAll || !pipelineFound) {
            displayAllPipelines(pipelinesData);
        }
        
        // Show detailed analysis if requested
        if (showDetails && targetPipeline) {
            log('\n🔍 DETAILED PIPELINE ANALYSIS', 'bright');
            log('='.repeat(50), 'cyan');
            log(`Pipeline ID: ${targetPipeline.id}`, 'cyan');
            log(`Pipeline Name: ${targetPipeline.name}`, 'bright');
            log(`Total Stages: ${targetPipeline.stages?.length || 0}`, 'green');
            
            if (targetPipeline.stages && targetPipeline.stages.length > 0) {
                log('\n📋 Stage Details:', 'yellow');
                targetPipeline.stages.forEach((stage, index) => {
                    log(`Stage ${index + 1}: ${stage.name}`, 'reset');
                    if (stage.id) log(`  - ID: ${stage.id}`, 'dim');
                    if (stage.order) log(`  - Order: ${stage.order}`, 'dim');
                    log('');
                });
            }
        }
        
    } catch (error) {
        log(`❌ Failed to fetch pipelines: ${error.message}`, 'red');
        process.exit(1);
    }
    
    log('\n🎉 Pipeline fetch completed successfully!', 'green');
    log('\n💡 Available commands:', 'yellow');
    log('   node get-pipelines-standalone.js', 'cyan');
    log('   node get-pipelines-standalone.js --all', 'cyan');
    log('   node get-pipelines-standalone.js --details', 'cyan');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log(`
🚀 GoHighLevel Pipeline Fetcher (Standalone)

🎯 TARGET: Client Software Development Pipeline (ID: uR2CMkTiwqoUOYuf8oGR)

Usage:
  node get-pipelines-standalone.js                                    # Get target pipeline only
  node get-pipelines-standalone.js --all                             # Show all pipelines + target
  node get-pipelines-standalone.js --details                         # Show target pipeline with detailed analysis
  node get-pipelines-standalone.js --help                            # Show this help

Options:
  --all, -a        Show all available pipelines in addition to target
  --details, -d    Show detailed analysis of target pipeline
  --help, -h       Show this help message

Requirements:
  - Running ghl-oauth-server.js on port 3000
  - Valid OAuth authentication

Examples:
  node get-pipelines-standalone.js                                   # Target pipeline only
  node get-pipelines-standalone.js --all                            # All pipelines + target
  node get-pipelines-standalone.js --details                        # Target with detailed analysis

Note: This script focuses on the Client Software Development Pipeline by default.
`, 'bright');
    process.exit(0);
}

// Run the script
main().catch(error => {
    log(`❌ Script failed: ${error.message}`, 'red');
    process.exit(1);
}); 