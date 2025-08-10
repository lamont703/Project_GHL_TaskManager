#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_URL = 'http://127.0.0.1:3000';

// Target pipeline configuration (matching get-pipelines-standalone.js)
const TARGET_PIPELINE = {
    name: 'Client Software Development Pipeline',
    id: 'uR2CMkTiwqoUOYuf8oGR'
};

// Color codes for terminal output
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

// Helper function for colored logging
function log(message, color = 'reset') {
    const colorCode = colors[color] || colors.reset;
    console.log(`${colorCode}${message}${colors.reset}`);
}

// Check if tokens file exists and load tokens
function loadTokensFromFile() {
    try {
        const tokensPath = path.join(process.cwd(), '.tokens.json');
        if (fs.existsSync(tokensPath)) {
            const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
            return tokensData;
        }
    } catch (error) {
        log(`Warning: Could not load tokens file: ${error.message}`, 'yellow');
    }
    return null;
}

// Check server health
async function checkServerHealth() {
    try {
        const response = await axios.get(`${SERVER_URL}/health`);
        return response.data;
    } catch (error) {
        throw new Error(`Server health check failed: ${error.message}`);
    }
}

// Check OAuth status with fallback to file tokens
async function checkOAuthStatus() {
    try {
        // First try the server endpoint
        const response = await axios.get(`${SERVER_URL}/oauth/status`);
        return response.data;
    } catch (error) {
        log('⚠️  Server OAuth status check failed, trying file tokens...', 'yellow');
        
        // Fallback to file tokens
        const fileTokens = loadTokensFromFile();
        if (fileTokens && fileTokens.access_token) {
            return {
                authenticated: true,
                location_id: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                message: 'Authenticated via file tokens',
                source: 'file'
            };
        }
        
        throw new Error(`OAuth status check failed: ${error.message}`);
    }
}

// Get all opportunities for the location
async function getAllOpportunities() {
    try {
        // Try the opportunities endpoint
        const response = await axios.get(`${SERVER_URL}/opportunities`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            log('⚠️  Opportunities endpoint not available yet. Trying alternative methods...', 'yellow');
            
            // For now, return a message that the endpoint needs to be added
            return {
                success: false,
                message: 'Opportunities endpoint not yet available. Server needs to be restarted to load new endpoint.',
                location_id: 'QLyYYRoOhCg65lKW9HDX',
                opportunities: []
            };
        }
        
        // If it's an authentication error, try with file tokens
        if (error.response?.status === 401) {
            log('⚠️  Server authentication failed, trying with file tokens...', 'yellow');
            return await getOpportunitiesWithFileTokens();
        }
        
        // If it's a GoHighLevel IAM limitation, try direct API call
        if (error.response?.data?.message && error.response.data.message.includes('not yet supported by the IAM Service')) {
            log('⚠️  GoHighLevel IAM Service limitation detected. Trying direct API call...', 'yellow');
            return await getOpportunitiesWithFileTokens();
        }
        
        // Check for nested error details (GoHighLevel API format)
        if (error.response?.data?.details?.message && error.response.data.details.message.includes('not yet supported by the IAM Service')) {
            log('⚠️  GoHighLevel IAM Service limitation detected (nested). Trying direct API call...', 'yellow');
            return await getOpportunitiesWithFileTokens();
        }
        
        // Debug: Log the actual error response
        log(`🔍 Debug - Error response: ${JSON.stringify(error.response?.data || error.message)}`, 'cyan');
        
        // If we get here, it's an unexpected error
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.response?.data?.details?.message || error.message;
        throw new Error(`Failed to fetch opportunities: ${errorMessage}`);
    }
}

// Get opportunities using file tokens directly
async function getOpportunitiesWithFileTokens() {
    try {
        const fileTokens = loadTokensFromFile();
        if (!fileTokens || !fileTokens.access_token) {
            throw new Error('No file tokens available');
        }
        
        log('🔑 Using file tokens to fetch opportunities directly...', 'blue');
        
        // First try to get a list of opportunity IDs from contacts or other sources
        log('🔍 Attempting to find opportunity IDs from available data...', 'blue');
        
        // Try to get opportunities from contacts (some contacts might have opportunity references)
        try {
            const contactsResponse = await axios.get('https://services.leadconnectorhq.com/contacts/', {
                headers: {
                    'Authorization': `Bearer ${fileTokens.access_token}`,
                    'Version': '2021-07-28'
                },
                params: {
                    locationId: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                    limit: 50
                }
            });
            
            const contacts = contactsResponse.data.contacts || contactsResponse.data || [];
            log(`📞 Found ${contacts.length} contacts to analyze`, 'green');
            
            // Look for contacts that might have opportunity references
            const contactsWithOpportunities = contacts.filter(contact => 
                contact.opportunityId || contact.opportunity_id || contact.pipelineId || contact.pipeline_id
            );
            
            if (contactsWithOpportunities.length > 0) {
                log(`🎯 Found ${contactsWithOpportunities.length} contacts with potential opportunity references`, 'green');
                
                // Try to fetch opportunities for these contacts
                const opportunities = [];
                for (const contact of contactsWithOpportunities.slice(0, 5)) { // Limit to 5 to avoid rate limiting
                    if (contact.opportunityId || contact.opportunity_id) {
                        const opportunityId = contact.opportunityId || contact.opportunity_id;
                        try {
                            const oppResponse = await axios.get(`https://services.leadconnectorhq.com/opportunities/${opportunityId}`, {
                                headers: {
                                    'Authorization': `Bearer ${fileTokens.access_token}`,
                                    'Version': '2021-07-28'
                                }
                            });
                            
                            if (oppResponse.data) {
                                opportunities.push(oppResponse.data);
                                log(`✅ Successfully fetched opportunity: ${oppResponse.data.title || oppResponse.data.name || opportunityId}`, 'green');
                            }
                        } catch (oppError) {
                            log(`⚠️  Could not fetch opportunity ${opportunityId}: ${oppError.response?.data?.message || oppError.message}`, 'yellow');
                        }
                    }
                }
                
                if (opportunities.length > 0) {
                    return {
                        success: true,
                        location_id: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                        opportunities: opportunities,
                        opportunities_count: opportunities.length,
                        source: 'individual_opportunities_by_id',
                        method: 'Fetched individual opportunities using opportunity IDs from contacts'
                    };
                }
            }
            
            // If no opportunities found through contacts, try to get some sample opportunity IDs
            log('🔍 No opportunity IDs found in contacts. Trying alternative approach...', 'yellow');
            
            // Try to get opportunities from the bulk endpoint with different parameters
            const opportunitiesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/', {
                headers: {
                    'Authorization': `Bearer ${fileTokens.access_token}`,
                    'Version': '2021-07-28'
                },
                params: {
                    locationId: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                    limit: 10,
                    offset: 0
                }
            });
            
            return {
                success: true,
                location_id: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                opportunities: opportunitiesResponse.data,
                opportunities_count: opportunitiesResponse.data.length || 0,
                source: 'bulk_opportunities_api'
            };
            
        } catch (contactsError) {
            log(`⚠️  Could not fetch contacts: ${contactsError.response?.data?.message || contactsError.message}`, 'yellow');
            
            // Fallback to direct opportunities call
            const opportunitiesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/', {
                headers: {
                    'Authorization': `Bearer ${fileTokens.access_token}`,
                    'Version': '2021-07-28'
                },
                params: {
                    locationId: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                    limit: 100
                }
            });
            
            return {
                success: true,
                location_id: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                opportunities: opportunitiesResponse.data,
                opportunities_count: opportunitiesResponse.data.length || 0,
                source: 'file_tokens_direct'
            };
        }
        
    } catch (error) {
        log(`❌ Direct API call failed: ${error.response?.data?.message || error.message}`, 'red');
        
        // Check if it's the same IAM limitation
        if (error.response?.data?.message && error.response.data.message.includes('not yet supported by the IAM Service')) {
            return {
                success: false,
                message: 'GoHighLevel IAM Service does not yet support opportunities for this integration type.',
                location_id: 'QLyYYRoOhCg65lKW9HDX',
                opportunities: [],
                error_details: error.response?.data || error.message,
                recommendation: 'This is a GoHighLevel platform limitation, not a code issue. Contact GoHighLevel support for updates.'
            };
        }
        
        // Return mock data for testing
        return {
            success: false,
            message: 'Direct API call failed. This might be due to API limitations.',
            location_id: 'QLyYYRoOhCg65lKW9HDX',
            opportunities: [],
            error_details: error.response?.data || error.message
        };
    }
}

// Search opportunities in our target pipeline using the search endpoint
async function searchPipelineOpportunities(pipelineId, locationId, accessToken) {
    try {
        log(`🔍 Searching for opportunities in pipeline: ${pipelineId}`, 'blue');
        
        const searchUrl = 'https://services.leadconnectorhq.com/opportunities/search';
        const params = {
            location_id: locationId,
            pipeline_id: pipelineId,
            limit: 100, // Get up to 100 opportunities
            status: 'all' // Get all statuses (open, won, lost, abandoned)
        };
        
        const response = await axios.get(searchUrl, {
            params: params,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28',
                'Accept': 'application/json'
            }
        });
        
        const searchData = response.data;
        const opportunities = searchData.opportunities || [];
        const total = searchData.meta?.total || opportunities.length;
        
        log(`✅ Found ${total} opportunities in pipeline`, 'green');
        log(`📊 Retrieved ${opportunities.length} opportunities in this batch`, 'blue');
        
        return {
            success: true,
            location_id: locationId,
            pipeline_id: pipelineId,
            opportunities: opportunities,
            opportunities_count: opportunities.length,
            total_opportunities: total,
            source: 'pipeline_search',
            method: `Searched opportunities in pipeline: ${pipelineId}`,
            search_metadata: {
                endpoint: 'opportunities/search',
                pipeline_filter: pipelineId,
                status_filter: 'all',
                limit: 100
            }
        };
        
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('Authentication failed - token may be expired');
        } else if (error.response?.status === 400) {
            throw new Error(`Bad request: ${error.response.data?.message || 'Invalid search parameters'}`);
        } else if (error.response?.status === 422) {
            throw new Error(`Validation error: ${error.response.data?.message || 'Invalid search parameters'}`);
        } else {
            throw new Error(`Search failed: ${error.response?.data?.message || error.message}`);
        }
    }
}

// Get opportunities for a specific pipeline (legacy method)
async function getPipelineOpportunities(pipelineId) {
    try {
        const response = await axios.get(`${SERVER_URL}/pipelines/${pipelineId}/opportunities`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return {
                success: false,
                message: `Pipeline opportunities endpoint not available for pipeline: ${pipelineId}`,
                opportunities: []
            };
        }
        throw new Error(`Failed to fetch pipeline opportunities: ${error.response?.data?.error || error.message}`);
    }
}

// Get opportunities for a specific contact
async function getContactOpportunities(contactId) {
    try {
        const response = await axios.get(`${SERVER_URL}/contacts/${contactId}/opportunities`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return {
                success: false,
                message: `Contact opportunities endpoint not available for contact: ${contactId}`,
                opportunities: []
            };
        }
        throw new Error(`Failed to fetch contact opportunities: ${error.response?.data?.error || error.message}`);
    }
}

// Get a specific opportunity by ID
async function getOpportunityById(opportunityId) {
    try {
        const fileTokens = loadTokensFromFile();
        if (!fileTokens || !fileTokens.access_token) {
            throw new Error('No file tokens available');
        }
        
        log(`🔍 Fetching opportunity with ID: ${opportunityId}`, 'blue');
        
        const response = await axios.get(`https://services.leadconnectorhq.com/opportunities/${opportunityId}`, {
            headers: {
                'Authorization': `Bearer ${fileTokens.access_token}`,
                'Version': '2021-07-28'
            }
        });
        
        return {
            success: true,
            opportunity: response.data,
            source: 'direct_api_call'
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Failed to fetch opportunity ${opportunityId}`,
            error_details: error.response?.data || error.message
        };
    }
}

// Display opportunities information
function displayOpportunities(opportunitiesData) {
    log('\n💼 OPPORTUNITIES OVERVIEW', 'bright');
    log('='.repeat(50), 'cyan');
    
    // Handle error cases first
    if (!opportunitiesData.success && opportunitiesData.message) {
        log(`❌ ${opportunitiesData.message}`, 'red');
        if (opportunitiesData.recommendation) {
            log(`💡 ${opportunitiesData.recommendation}`, 'yellow');
        }
        if (opportunitiesData.error_details) {
            log(`🔍 Error Details: ${JSON.stringify(opportunitiesData.error_details, null, 2)}`, 'cyan');
        }
        return;
    }
    
    const opportunities = opportunitiesData.opportunities || opportunitiesData || [];
    
    if (!opportunities || opportunities.length === 0) {
        log('❌ No opportunities found', 'red');
        return;
    }
    
    // Show pipeline information if available
    if (opportunitiesData.pipeline_id) {
        log(`🎯 Pipeline: ${TARGET_PIPELINE.name}`, 'bright');
        log(`🔧 Pipeline ID: ${opportunitiesData.pipeline_id}`, 'cyan');
    }
    
    log(`📍 Location ID: ${opportunitiesData.location_id || 'N/A'}`, 'blue');
    log(`📊 Total Opportunities: ${opportunities.length}`, 'green');
    
    if (opportunitiesData.total_opportunities && opportunitiesData.total_opportunities !== opportunities.length) {
        log(`📈 Total in Pipeline: ${opportunitiesData.total_opportunities}`, 'yellow');
    }
    
    if (opportunitiesData.source) {
        log(`🔍 Source: ${opportunitiesData.source}`, 'dim');
    }
    
    log('');
    
    opportunities.forEach((opportunity, index) => {
        log(`${index + 1}. ${opportunity.title || opportunity.name || 'Untitled Opportunity'}`, 'bright');
        log(`   ID: ${opportunity.id}`, 'cyan');
        log(`   Status: ${opportunity.status || 'N/A'}`, 'yellow');
        log(`   Pipeline: ${opportunity.pipelineId || opportunity.pipeline_id || 'N/A'}`, 'magenta');
        log(`   Stage: ${opportunity.stage || opportunity.stageName || 'N/A'}`, 'blue');
        log(`   Value: ${opportunity.value ? `$${opportunity.value.toLocaleString()}` : 'N/A'}`, 'green');
        log(`   Probability: ${opportunity.probability || 'N/A'}%`, 'cyan');
        
        if (opportunity.contactId || opportunity.contact_id) {
            log(`   Contact: ${opportunity.contactId || opportunity.contact_id}`, 'blue');
        }
        
        if (opportunity.assignedTo || opportunity.assigned_to) {
            log(`   Assigned To: ${opportunity.assignedTo || opportunity.assigned_to}`, 'yellow');
        }
        
        if (opportunity.dateCreated || opportunity.date_created) {
            const date = new Date(opportunity.dateCreated || opportunity.date_created);
            log(`   Created: ${date.toLocaleDateString()}`, 'green');
        }
        
        if (opportunity.expectedCloseDate || opportunity.expected_close_date) {
            const closeDate = new Date(opportunity.expectedCloseDate || opportunity.expected_close_date);
            log(`   Expected Close: ${closeDate.toLocaleDateString()}`, 'magenta');
        }
        
        if (opportunity.description) {
            log(`   Description: ${opportunity.description}`, 'reset');
        }
        
        if (opportunity.source) {
            log(`   Source: ${opportunity.source}`, 'cyan');
        }
        
        log('');
    });
}

// Display opportunity statistics
function displayOpportunityStats(opportunitiesData) {
    log('\n📈 OPPORTUNITY STATISTICS', 'bright');
    log('='.repeat(30), 'cyan');
    
    const opportunities = opportunitiesData.opportunities || opportunitiesData || [];
    
    if (opportunities.length === 0) return;
    
    // Count opportunities by status
    const statusCounts = {};
    opportunities.forEach(opportunity => {
        const status = opportunity.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    log('📊 Status Breakdown:', 'bright');
    Object.entries(statusCounts).forEach(([status, count]) => {
        log(`   ${status}: ${count}`, 'cyan');
    });
    
    // Count opportunities by pipeline
    const pipelineCounts = {};
    opportunities.forEach(opportunity => {
        const pipeline = opportunity.pipelineId || opportunity.pipeline_id || 'Unknown';
        pipelineCounts[pipeline] = (pipelineCounts[pipeline] || 0) + 1;
    });
    
    log('\n🏗️  Pipeline Breakdown:', 'bright');
    Object.entries(pipelineCounts).forEach(([pipeline, count]) => {
        log(`   ${pipeline}: ${count}`, 'magenta');
    });
    
    // Calculate total value
    const totalValue = opportunities.reduce((sum, opp) => {
        return sum + (opp.value || 0);
    }, 0);
    
    if (totalValue > 0) {
        log(`\n💰 Total Pipeline Value: $${totalValue.toLocaleString()}`, 'green');
        
        // Average opportunity value
        const avgValue = totalValue / opportunities.length;
        log(`📊 Average Opportunity Value: $${avgValue.toLocaleString()}`, 'green');
    }
    
    // Count by probability ranges
    const probabilityRanges = {
        '0-25%': 0,
        '26-50%': 0,
        '51-75%': 0,
        '76-100%': 0
    };
    
    opportunities.forEach(opportunity => {
        const prob = opportunity.probability || 0;
        if (prob <= 25) probabilityRanges['0-25%']++;
        else if (prob <= 50) probabilityRanges['26-50%']++;
        else if (prob <= 75) probabilityRanges['51-75%']++;
        else probabilityRanges['76-100%']++;
    });
    
    log('\n🎯 Probability Breakdown:', 'bright');
    Object.entries(probabilityRanges).forEach(([range, count]) => {
        if (count > 0) {
            log(`   ${range}: ${count}`, 'yellow');
        }
    });
    
    // Show recent opportunities (last 5)
    const recentOpportunities = opportunities
        .filter(opp => opp.dateCreated || opp.date_created)
        .sort((a, b) => new Date(b.dateCreated || b.date_created) - new Date(a.dateCreated || a.date_created))
        .slice(0, 5);
    
    if (recentOpportunities.length > 0) {
        log('\n🆕 Recent Opportunities:', 'bright');
        recentOpportunities.forEach((opp, index) => {
            const date = new Date(opp.dateCreated || opp.date_created);
            log(`   ${index + 1}. ${opp.title || opp.name || 'Untitled'} - ${date.toLocaleDateString()}`, 'cyan');
        });
    }
    
    // Show high-value opportunities
    const highValueOpps = opportunities
        .filter(opp => opp.value && opp.value > 10000)
        .sort((a, b) => (b.value || 0) - (a.value || 0))
        .slice(0, 3);
    
    if (highValueOpps.length > 0) {
        log('\n💎 High-Value Opportunities:', 'bright');
        highValueOpps.forEach((opp, index) => {
            log(`   ${index + 1}. ${opp.title || opp.name || 'Untitled'} - $${opp.value.toLocaleString()}`, 'green');
        });
    }
}

// Main function
async function main() {
    try {
        log('🚀 GoHighLevel Opportunity Fetcher (Standalone)', 'bright');
        log(`🎯 Targeting opportunities in: ${TARGET_PIPELINE.name}`, 'cyan');
        log('Connecting to running server...\n');
        
        // Step 1: Check server health
        log('1. Checking server health...', 'blue');
        const healthData = await checkServerHealth();
        log('✅ Server is healthy', 'green');
        
        // Step 2: Check OAuth status
        log('\n2. Checking authentication...', 'blue');
        const oauthData = await checkOAuthStatus();
        
        if (oauthData.authenticated) {
            log(`✅ Authenticated for location: ${oauthData.location_id}`, 'green');
            if (oauthData.source === 'file') {
                log('📁 Using authentication from file tokens', 'yellow');
            } else {
                log('🌐 Using authentication from server', 'yellow');
            }
            if (oauthData.expiresAt) {
                const expiresDate = new Date(oauthData.expiresAt);
                log(`⏰ Expires: ${expiresDate.toLocaleString()}`, 'yellow');
            }
        } else {
            log('❌ Not authenticated. Please authenticate first.', 'red');
            log('\n💡 Authenticate by visiting:', 'yellow');
            log(`   ${SERVER_URL}/oauth/init`, 'cyan');
            log('\nOr ensure your server is running and has valid tokens.', 'yellow');
            return;
        }
        
        // Step 3: Fetch opportunities in our target pipeline
        log('\n3. Fetching opportunities in target pipeline...', 'blue');
        log(`🎯 Target Pipeline: ${TARGET_PIPELINE.name} (ID: ${TARGET_PIPELINE.id})`, 'cyan');
        
        let opportunitiesData;
        
        // First try to get opportunities specifically in our target pipeline
        try {
            if (oauthData.source === 'file' && oauthData.access_token) {
                // Use file tokens directly
                opportunitiesData = await searchPipelineOpportunities(
                    TARGET_PIPELINE.id, 
                    oauthData.location_id, 
                    oauthData.access_token
                );
            } else {
                // Try to get tokens from server
                const tokensResponse = await axios.get(`${SERVER_URL}/oauth/tokens`);
                const tokens = tokensResponse.data;
                
                if (tokens && tokens.access_token) {
                    opportunitiesData = await searchPipelineOpportunities(
                        TARGET_PIPELINE.id, 
                        oauthData.location_id, 
                        tokens.access_token
                    );
                } else {
                    throw new Error('No access token available');
                }
            }
            
            log('✅ Pipeline opportunities fetched successfully', 'green');
            
        } catch (pipelineError) {
            log(`⚠️  Pipeline search failed: ${pipelineError.message}`, 'yellow');
            log('🔄 Falling back to general opportunities fetch...', 'yellow');
            
            // Fallback to general opportunities fetch
            opportunitiesData = await getAllOpportunities();
        }
        
        // Step 4: Display results
        displayOpportunities(opportunitiesData);
        displayOpportunityStats(opportunitiesData);
        
        log('\n🎉 Opportunity fetch completed successfully!', 'bright');
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Help function
function showHelp() {
    log('\n📖 GoHighLevel Opportunity Fetcher - Help', 'bright');
    log('='.repeat(50), 'cyan');
    log('\nThis script fetches opportunities specifically in your Client Software Development Pipeline.');
    log('It connects to your running server and displays pipeline-specific opportunity information.');
    
    log('\n🎯 Target Pipeline:', 'yellow');
    log(`   • Name: ${TARGET_PIPELINE.name}`, 'cyan');
    log(`   • ID: ${TARGET_PIPELINE.id}`, 'cyan');
    
    log('\n💡 Available commands:', 'yellow');
    log('   node get-opportunities-standalone.js', 'cyan');
    log('   node get-opportunities-standalone.js --opportunity-id <ID>', 'cyan');
    
    log('\n📋 What you get:', 'yellow');
    log('   • Opportunities specifically in your target pipeline', 'cyan');
    log('   • Opportunity details (title, status, stage, value)', 'cyan');
    log('   • Pipeline-specific statistics and analytics', 'cyan');
    log('   • Stage breakdown and value analysis', 'cyan');
    log('   • Probability analysis and high-value opportunities', 'cyan');
    log('   • Ability to fetch specific opportunities by ID', 'cyan');
    
    log('\n🔧 Requirements:', 'yellow');
    log('   • Your server must be running (ghl-oauth-server.js)', 'cyan');
    log('   • You must be authenticated with GoHighLevel', 'cyan');
    log('   • opportunities.readonly scope required', 'cyan');
    
    log('\nExamples:', 'yellow');
    log('   node get-opportunities-standalone.js', 'cyan');
    log('   node get-opportunities-standalone.js --opportunity-id 1234567890abcdef1234567890abcdef', 'cyan');
    
    log('\nNote: This script prioritizes pipeline-specific opportunities and falls back to general fetch if needed.', 'blue');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Check if user wants to fetch a specific opportunity by ID
const opportunityIdIndex = process.argv.indexOf('--opportunity-id');
if (opportunityIdIndex !== -1 && process.argv[opportunityIdIndex + 1]) {
    const opportunityId = process.argv[opportunityIdIndex + 1];
    log('🎯 Fetching specific opportunity by ID...', 'bright');
    
    getOpportunityById(opportunityId).then(result => {
        if (result.success) {
            log('\n💼 OPPORTUNITY DETAILS', 'bright');
            log('='.repeat(50), 'cyan');
            displayOpportunities({ opportunities: [result.opportunity] });
        } else {
            log(`❌ ${result.message}`, 'red');
            if (result.error_details) {
                log(`🔍 Error Details: ${JSON.stringify(result.error_details, null, 2)}`, 'cyan');
            }
        }
    }).catch(error => {
        log(`💥 Error: ${error.message}`, 'red');
        process.exit(1);
    });
} else {
    // Run the main function for all opportunities
main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
}); 
} 