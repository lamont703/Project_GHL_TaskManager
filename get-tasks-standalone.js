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

// Check OAuth status
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

// Get tasks from opportunities in our target pipeline using the search endpoint
async function getTasksFromPipelineOpportunities(pipelineId, locationId, accessToken) {
    try {
        log(`🔍 Searching for opportunities with tasks in pipeline: ${pipelineId}`, 'blue');
        
        const searchUrl = 'https://services.leadconnectorhq.com/opportunities/search';
        const params = {
            location_id: locationId,
            pipeline_id: pipelineId,
            getTasks: true, // This is the key parameter to get tasks!
            limit: 100, // Get up to 100 opportunities
            status: 'all' // Get all statuses
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
        
        // Extract all tasks from opportunities
        const allTasks = [];
        const opportunitiesWithTasks = [];
        
        opportunities.forEach(opportunity => {
            if (opportunity.tasks && Array.isArray(opportunity.tasks) && opportunity.tasks.length > 0) {
                // Add opportunity context to each task
                const tasksWithContext = opportunity.tasks.map(task => ({
                    ...task,
                    opportunity_id: opportunity.id,
                    opportunity_title: opportunity.title || opportunity.name || 'Untitled',
                    opportunity_status: opportunity.status,
                    opportunity_stage: opportunity.stage || opportunity.stageName,
                    opportunity_value: opportunity.value,
                    pipeline_id: opportunity.pipelineId || opportunity.pipeline_id
                }));
                
                allTasks.push(...tasksWithContext);
                opportunitiesWithTasks.push({
                    opportunity: opportunity,
                    tasks: opportunity.tasks,
                    task_count: opportunity.tasks.length
                });
            }
        });
        
        log(`✅ Found ${opportunities.length} opportunities in pipeline`, 'green');
        log(`📋 Found ${allTasks.length} total tasks across opportunities`, 'green');
        log(`🎯 Opportunities with tasks: ${opportunitiesWithTasks.length}`, 'blue');
        
        return {
            success: true,
            location_id: locationId,
            pipeline_id: pipelineId,
            opportunities: opportunities,
            opportunities_count: opportunities.length,
            tasks: allTasks,
            tasks_count: allTasks.length,
            opportunities_with_tasks: opportunitiesWithTasks,
            source: 'pipeline_opportunities_search',
            method: `Searched opportunities with tasks in pipeline: ${pipelineId}`,
            search_metadata: {
                endpoint: 'opportunities/search',
                pipeline_filter: pipelineId,
                getTasks: true,
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

// Get all tasks for the location (legacy method)
async function getAllTasks() {
    try {
        // Try the tasks endpoint
        const response = await axios.get(`${SERVER_URL}/tasks`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            // If tasks endpoint doesn't exist, try to get task info from other sources
            log('⚠️  Tasks endpoint not available yet. Trying alternative methods...', 'yellow');
            
            // Try with file tokens as fallback
            log('🔄 Attempting to fetch tasks using file tokens...', 'yellow');
            return await getTasksWithFileTokens();
        }
        
        // If it's an authentication error, try with file tokens
        if (error.response?.status === 401) {
            log('⚠️  Server authentication failed, trying with file tokens...', 'yellow');
            return await getTasksWithFileTokens();
        }
        
        throw new Error(`Failed to fetch tasks: ${error.response?.data?.error || error.message}`);
    }
}

// Get tasks using file tokens directly from GoHighLevel API
async function getTasksWithFileTokens() {
    try {
        const fileTokens = loadTokensFromFile();
        if (!fileTokens || !fileTokens.access_token) {
            throw new Error('No file tokens available');
        }
        
        log('🔑 Using file tokens to fetch tasks directly...', 'blue');
        
        // First get contacts to find tasks
        log('🔍 Fetching contacts to find associated tasks...', 'blue');
        
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
        log(`📞 Found ${contacts.length} contacts to check for tasks`, 'green');
        
        // Fetch tasks for each contact
        const allTasks = [];
        let tasksFound = 0;
        
        for (const contact of contacts.slice(0, 10)) { // Limit to 10 contacts to avoid rate limiting
            try {
                const tasksResponse = await axios.get(`https://services.leadconnectorhq.com/contacts/${contact.id}/tasks`, {
                    headers: {
                        'Authorization': `Bearer ${fileTokens.access_token}`,
                        'Version': '2021-07-28'
                    }
                });
                
                const contactTasks = tasksResponse.data.tasks || tasksResponse.data || [];
                if (contactTasks.length > 0) {
                    log(`✅ Found ${contactTasks.length} tasks for contact: ${contact.contactName || contact.firstName || contact.id}`, 'green');
                    
                    // Add contact info to each task
                    const tasksWithContact = contactTasks.map(task => ({
                        ...task,
                        contactId: contact.id,
                        contactName: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown Contact'
                    }));
                    
                    allTasks.push(...tasksWithContact);
                    tasksFound += contactTasks.length;
                }
            } catch (taskError) {
                if (taskError.response?.status === 404) {
                    // No tasks for this contact, which is normal
                    continue;
                }
                log(`⚠️  Could not fetch tasks for contact ${contact.id}: ${taskError.response?.data?.message || taskError.message}`, 'yellow');
            }
        }
        
        if (allTasks.length > 0) {
            return {
                success: true,
                location_id: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                tasks: allTasks,
                tasks_count: allTasks.length,
                source: 'contact_tasks_api',
                method: `Fetched tasks from ${contacts.length} contacts using GoHighLevel API`
            };
        } else {
            return {
                success: true,
                location_id: fileTokens.locationId || 'QLyYYRoOhCg65lKW9HDX',
                tasks: [],
                tasks_count: 0,
                source: 'contact_tasks_api',
                message: 'No tasks found for any contacts',
                method: `Checked ${contacts.length} contacts for tasks`
            };
        }
        
    } catch (error) {
        log(`❌ Direct API call failed: ${error.response?.data?.message || error.message}`, 'red');
        
        return {
            success: false,
            message: 'Failed to fetch tasks from GoHighLevel API',
            location_id: 'QLyYYRoOhCg65lKW9HDX',
            tasks: [],
            error_details: error.response?.data || error.message
        };
    }
}

// Get tasks for a specific pipeline
async function getPipelineTasks(pipelineId) {
    try {
        const response = await axios.get(`${SERVER_URL}/pipelines/${pipelineId}/tasks`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return {
                success: false,
                message: `Pipeline tasks endpoint not available for pipeline: ${pipelineId}`,
                tasks: []
            };
        }
        throw new Error(`Failed to fetch pipeline tasks: ${error.response?.data?.error || error.message}`);
    }
}

// Display tasks information
function displayTasks(tasksData) {
    log('\n📋 TASKS OVERVIEW', 'bright');
    log('='.repeat(50), 'cyan');
    
    const tasks = tasksData.tasks || tasksData || [];
    
    if (!tasks || tasks.length === 0) {
        log('❌ No tasks found', 'red');
        return;
    }
    
    // Show pipeline information if available
    if (tasksData.pipeline_id) {
        log(`🎯 Pipeline: ${TARGET_PIPELINE.name}`, 'bright');
        log(`🔧 Pipeline ID: ${tasksData.pipeline_id}`, 'cyan');
    }
    
    log(`📍 Location ID: ${tasksData.location_id || 'N/A'}`, 'blue');
    log(`📊 Total Tasks: ${tasks.length}`, 'green');
    
    if (tasksData.opportunities_count) {
        log(`🎯 Opportunities with Tasks: ${tasksData.opportunities_with_tasks?.length || 0}`, 'yellow');
    }
    
    if (tasksData.source) {
        log(`🔍 Source: ${tasksData.source}`, 'dim');
    }
    
    log('');
    
    tasks.forEach((task, index) => {
        log(`${index + 1}. ${task.title || task.name || 'Untitled Task'}`, 'bright');
        log(`   ID: ${task.id}`, 'cyan');
        log(`   Status: ${task.status || 'N/A'}`, 'yellow');
        log(`   Priority: ${task.priority || 'N/A'}`, 'magenta');
        log(`   Due Date: ${task.dueDate || task.due_date || 'N/A'}`, 'green');
        log(`   Assigned To: ${task.assignedTo || task.assigned_to || 'N/A'}`, 'blue');
        
        // Show opportunity context if available
        if (task.opportunity_title) {
            log(`   🎯 Opportunity: ${task.opportunity_title}`, 'bright');
            log(`   📊 Opportunity Status: ${task.opportunity_status || 'N/A'}`, 'yellow');
            log(`   🏗️  Pipeline Stage: ${task.opportunity_stage || 'N/A'}`, 'cyan');
            if (task.opportunity_value) {
                log(`   💰 Opportunity Value: $${task.opportunity_value}`, 'green');
            }
        }
        
        if (task.description) {
            log(`   Description: ${task.description}`, 'reset');
        }
        
        if (task.pipelineId || task.pipeline_id) {
            log(`   Pipeline: ${task.pipelineId || task.pipeline_id}`, 'cyan');
        }
        
        if (task.contactId || task.contact_id) {
            log(`   Contact: ${task.contactId || task.contact_id}`, 'blue');
        }
        
        if (task.dateCreated || task.date_created) {
            const date = new Date(task.dateCreated || task.date_created);
            log(`   Created: ${date.toLocaleDateString()}`, 'green');
        }
        
        log('');
    });
}

// Display task statistics
function displayTaskStats(tasksData) {
    log('\n📈 TASK STATISTICS', 'bright');
    log('='.repeat(30), 'cyan');
    
    const tasks = tasksData.tasks || tasksData || [];
    
    if (tasks.length === 0) return;
    
    // Count tasks by status
    const statusCounts = {};
    tasks.forEach(task => {
        const status = task.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    log('📊 Status Breakdown:', 'bright');
    Object.entries(statusCounts).forEach(([status, count]) => {
        log(`   ${status}: ${count}`, 'cyan');
    });
    
    // Count tasks by priority
    const priorityCounts = {};
    tasks.forEach(task => {
        const priority = task.priority || 'Unknown';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });
    
    log('\n🎯 Priority Breakdown:', 'bright');
    Object.entries(priorityCounts).forEach(([priority, count]) => {
        log(`   ${priority}: ${count}`, 'magenta');
    });
    
    // Count overdue tasks
    const now = new Date();
    const overdueTasks = tasks.filter(task => {
        const dueDate = task.dueDate || task.due_date;
        if (!dueDate) return false;
        return new Date(dueDate) < now;
    });
    
    if (overdueTasks.length > 0) {
        log(`\n⚠️  Overdue Tasks: ${overdueTasks.length}`, 'red');
        overdueTasks.slice(0, 5).forEach((task, index) => {
            const dueDate = new Date(task.dueDate || task.due_date);
            log(`   ${index + 1}. ${task.title || task.name || 'Untitled'} - Due: ${dueDate.toLocaleDateString()}`, 'red');
        });
    }
    
    // Show recent tasks (last 5)
    const recentTasks = tasks
        .filter(task => task.dateCreated || task.date_created)
        .sort((a, b) => new Date(b.dateCreated || b.date_created) - new Date(a.dateCreated || a.date_created))
        .slice(0, 5);
    
    if (recentTasks.length > 0) {
        log('\n🆕 Recent Tasks:', 'bright');
        recentTasks.forEach((task, index) => {
            const date = new Date(task.dateCreated || task.date_created);
            log(`   ${index + 1}. ${task.title || task.name || 'Untitled'} - ${date.toLocaleDateString()}`, 'cyan');
        });
    }
}

// Main function
async function main() {
    try {
        log('🚀 GoHighLevel Task Fetcher (Standalone)', 'bright');
        log(`🎯 Targeting tasks in: ${TARGET_PIPELINE.name}`, 'cyan');
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
        
        // Step 3: Fetch tasks from our target pipeline
        log('\n3. Fetching tasks from target pipeline...', 'blue');
        log(`🎯 Target Pipeline: ${TARGET_PIPELINE.name} (ID: ${TARGET_PIPELINE.id})`, 'cyan');
        
        let tasksData;
        
        // First try to get tasks specifically from our target pipeline opportunities
        try {
            if (oauthData.source === 'file' && oauthData.access_token) {
                // Use file tokens directly
                tasksData = await getTasksFromPipelineOpportunities(
                    TARGET_PIPELINE.id, 
                    oauthData.location_id, 
                    oauthData.access_token
                );
            } else {
                // Try to get tokens from server
                const tokensResponse = await axios.get(`${SERVER_URL}/oauth/tokens`);
                const tokens = tokensResponse.data;
                
                if (tokens && tokens.access_token) {
                    tasksData = await getTasksFromPipelineOpportunities(
                        TARGET_PIPELINE.id, 
                        oauthData.location_id, 
                        tokens.access_token
                    );
                } else {
                    throw new Error('No access token available');
                }
            }
            
            log('✅ Pipeline tasks fetched successfully', 'green');
            
        } catch (pipelineError) {
            log(`⚠️  Pipeline search failed: ${pipelineError.message}`, 'yellow');
            log('🔄 Falling back to general tasks fetch...', 'yellow');
            
            // Fallback to general tasks fetch
            tasksData = await getAllTasks();
        }
        
        // Step 4: Display results
        displayTasks(tasksData);
        displayTaskStats(tasksData);
        
        log('\n🎉 Task fetch completed successfully!', 'bright');
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Help function
function showHelp() {
    log('\n📖 GoHighLevel Task Fetcher - Help', 'bright');
    log('='.repeat(50), 'cyan');
    log('\nThis script fetches tasks specifically from opportunities in your Client Software Development Pipeline.');
    log('It connects to your running server and displays pipeline-specific task information.');
    
    log('\n🎯 Target Pipeline:', 'yellow');
    log(`   • Name: ${TARGET_PIPELINE.name}`, 'cyan');
    log(`   • ID: ${TARGET_PIPELINE.id}`, 'cyan');
    
    log('\n💡 Available commands:', 'yellow');
    log('   node get-tasks-standalone.js', 'cyan');
    
    log('\n📋 What you get:', 'yellow');
    log('   • Tasks from opportunities in your target pipeline', 'cyan');
    log('   • Task details with opportunity context', 'cyan');
    log('   • Task statistics and analytics', 'cyan');
    log('   • Overdue task alerts', 'cyan');
    log('   • Recent task additions', 'cyan');
    log('   • Tasks organized by opportunity', 'cyan');
    log('   • Pipeline stage and value information', 'cyan');
    log('   • Direct GoHighLevel API integration', 'cyan');
    
    log('\n🔧 Requirements:', 'yellow');
    log('   • Your server must be running (ghl-oauth-server.js)', 'cyan');
    log('   • You must be authenticated with GoHighLevel', 'cyan');
    log('   • opportunities.readonly scope required', 'cyan');
    log('   • Or valid tokens in .tokens.json file', 'cyan');
    
    log('\nExamples:', 'yellow');
    log('   node get-tasks-standalone.js', 'cyan');
    
    log('\nNote: This script prioritizes pipeline-specific tasks but falls back to general task fetching if needed.', 'blue');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Run the main function
main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
}); 