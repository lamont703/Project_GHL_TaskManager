const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Environment variables
const CLIENT_ID = process.env.GHL_CLIENT_ID;
const CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GHL_REDIRECT_URI;
const WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

app.use(express.json());

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    
    next();
});

// Helper function to create standardized GHL API headers
function createGHLHeaders(accessToken) {
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
    };
    return headers;
}

// OAuth initialization endpoint
app.get('/oauth/init', (req, res) => {
    const state = crypto.randomBytes(32).toString('hex');
    const authUrl = `https://marketplace.leadconnectorhq.com/oauth/chooselocation?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI || 'http://localhost:3000/oauth/callback')}&state=${state}&scope=contacts.readonly contacts.write opportunities.readonly opportunities.write calendars.readonly calendars.write locations.readonly users.readonly`;
    
    res.json({
        success: true,
        auth_url: authUrl,
        message: 'Visit the auth_url to authenticate with GoHighLevel',
        state: state
    });
});

// OAuth status endpoint
app.get('/oauth/status', async (req, res) => {
    const locationId = 'QLyYYRoOhCg65lKW9HDX';
    const tokens = await getStoredTokens(locationId);
    
    if (!tokens) {
        return res.json({
            authenticated: false,
            message: 'No tokens found. Please visit /oauth/init to authenticate.',
            location_id: locationId
        });
    }
    
    // Check if token is expired
    const now = new Date();
    const isExpired = tokens.expires_at && new Date(tokens.expires_at) < now;
    
    res.json({
        authenticated: !isExpired,
        expires_at: tokens.expires_at,
        location_id: locationId,
        message: isExpired ? 'Token expired. Please re-authenticate.' : 'Authenticated successfully'
    });
});

// OAuth callback endpoint
app.get('/oauth/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
    }
    
    try {
        // Exchange code for tokens
        const tokenData = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI || 'http://localhost:3000/oauth/callback'
        });
        
        const tokenResponse = await axios.post('https://services.leadconnectorhq.com/oauth/token', tokenData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('Token response:', JSON.stringify(tokenResponse.data, null, 2));
        
        const { access_token, refresh_token, expires_in, locationId } = tokenResponse.data;
        
        // Store tokens in database
        await storeTokens(locationId, access_token, refresh_token, expires_in);
        
        // Initialize integration for this location
        await initializeIntegration(locationId, access_token);
        
        res.json({ 
            success: true, 
            message: 'Integration successful',
            location_id: locationId 
        });
        
    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);
        res.status(500).json({ error: 'OAuth flow failed' });
    }
});

// Webhook endpoint for GoHighLevel events
app.post('/webhooks/ghl', async (req, res) => {
    const signature = req.headers['x-webhook-signature'];
    const body = JSON.stringify(req.body);
    
    // Verify webhook signature
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
    
    if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { type, location_id, data } = req.body;
    
    try {
        switch (type) {
            case 'ContactCreate':
                await handleContactCreate(location_id, data);
                break;
            case 'TaskCreate':
                await handleTaskCreate(location_id, data);
                break;
            case 'OpportunityCreate':
                await handleOpportunityCreate(location_id, data);
                break;
            case 'AppointmentCreate':
                await handleAppointmentCreate(location_id, data);
                break;
            default:
                console.log('Unhandled webhook type:', type);
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// API endpoint to sync tasks from your app to GHL
app.post('/api/sync-tasks', async (req, res) => {
    const { location_id, tasks } = req.body;
    
    try {
        const tokens = await getTokens(location_id);
        if (!tokens) {
            return res.status(404).json({ error: 'Integration not found' });
        }
        
        const results = [];
        
        for (const task of tasks) {
            const ghlTask = await createGHLTask(location_id, task, tokens.access_token);
            results.push(ghlTask);
        }
        
        res.json({ success: true, synced_tasks: results });
        
    } catch (error) {
        console.error('Task sync error:', error);
        res.status(500).json({ error: 'Task sync failed' });
    }
});

// Initialize integration after OAuth
async function initializeIntegration(locationId, accessToken) {
    try {
        // Get location details
        const locationResponse = await axios.get(`https://services.leadconnectorhq.com/locations/${locationId}`, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                Version: '2021-07-28'
            }
        });
        
        const location = locationResponse.data.location;
        
        // Store location details
        await storeLocationDetails(locationId, location);
        
        // Set up initial sync
        await performInitialSync(locationId, accessToken);
        
        console.log(`Integration initialized for location: ${location.name}`);
        
    } catch (error) {
        console.error('Integration initialization error:', error);
        throw error;
    }
}

// Handle contact creation from GHL
async function handleContactCreate(locationId, contactData) {
    try {
        // Create corresponding task in your system
        const newTask = {
            title: `Follow up with ${contactData.firstName} ${contactData.lastName}`,
            description: `New contact created: ${contactData.email}`,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'medium',
            status: 'incomplete',
            owner: 'Admin User',
            ghlContactId: contactData.id,
            locationId: locationId
        };
        
        await createTaskInYourSystem(newTask);
        
    } catch (error) {
        console.error('Contact creation handler error:', error);
    }
}

// Handle task creation from GHL
async function handleTaskCreate(locationId, taskData) {
    try {
        // Sync GHL task to your system
        const taskForYourSystem = {
            title: taskData.title,
            description: taskData.description,
            dueDate: taskData.dueDate,
            priority: taskData.priority || 'medium',
            status: taskData.completed ? 'complete' : 'incomplete',
            owner: taskData.assignedTo || 'Admin User',
            ghlTaskId: taskData.id,
            locationId: locationId
        };
        
        await createTaskInYourSystem(taskForYourSystem);
        
    } catch (error) {
        console.error('Task creation handler error:', error);
    }
}

// Create task in GoHighLevel
async function createGHLTask(locationId, task, accessToken) {
    try {
        const response = await axios.post(`https://services.leadconnectorhq.com/tasks/`, {
            title: task.title,
            description: task.description,
            contactId: task.ghlContactId,
            dueDate: task.dueDate,
            completed: task.status === 'complete',
            locationId: locationId
        }, {
            headers: createGHLHeaders(accessToken)
        });
        
        return response.data;
        
    } catch (error) {
        console.error('GHL task creation error:', error);
        throw error;
    }
}

// Handle opportunity creation from GHL
async function handleOpportunityCreate(locationId, opportunityData) {
    try {
        // Create follow-up task for new opportunity
        const followUpTask = {
            title: `Follow up on ${opportunityData.name}`,
            description: `New opportunity: ${opportunityData.monetaryValue} - ${opportunityData.pipelineStageId}`,
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'high',
            status: 'incomplete',
            owner: 'Admin User',
            ghlOpportunityId: opportunityData.id,
            locationId: locationId
        };
        
        await createTaskInYourSystem(followUpTask);
        
    } catch (error) {
        console.error('Opportunity creation handler error:', error);
    }
}

// Handle appointment creation from GHL
async function handleAppointmentCreate(locationId, appointmentData) {
    try {
        // Create preparation task for appointment
        const prepTask = {
            title: `Prepare for appointment: ${appointmentData.title}`,
            description: `Appointment scheduled for ${appointmentData.startTime}`,
            dueDate: new Date(new Date(appointmentData.startTime).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'medium',
            status: 'incomplete',
            owner: 'Admin User',
            ghlAppointmentId: appointmentData.id,
            locationId: locationId
        };
        
        await createTaskInYourSystem(prepTask);
        
    } catch (error) {
        console.error('Appointment creation handler error:', error);
    }
}

// Perform initial sync when integration is set up
async function performInitialSync(locationId, accessToken) {
    try {
        // Sync existing contacts
        const contactsResponse = await axios.get(`https://services.leadconnectorhq.com/contacts/`, {
            headers: createGHLHeaders(accessToken),
            params: { locationId: locationId, limit: 100 }
        });
        
        // Create follow-up tasks for recent contacts
        const recentContacts = contactsResponse.data.contacts
            .filter(contact => new Date(contact.dateAdded) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .slice(0, 10); // Limit to 10 most recent
        
        for (const contact of recentContacts) {
            await handleContactCreate(locationId, contact);
        }
        
        console.log(`Initial sync completed for ${recentContacts.length} contacts`);
        
    } catch (error) {
        console.error('Initial sync error:', error);
    }
}

// Token refresh functionality
async function refreshTokens(locationId) {
    try {
        const tokens = await getTokens(locationId);
        if (!tokens || !tokens.refresh_token) {
            throw new Error('No refresh token available');
        }
        
        const response = await axios.post('https://services.leadconnectorhq.com/oauth/token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token
        });
        
        const { access_token, refresh_token, expires_in } = response.data;
        
        // Update stored tokens
        await storeTokens(locationId, access_token, refresh_token, expires_in);
        
        return access_token;
        
    } catch (error) {
        console.error('Token refresh error:', error);
        throw error;
    }
}

// In-memory storage for testing (replace with real database in production)
const tokenStorage = new Map();

// Database functions (implement based on your database choice)
async function storeTokens(locationId, accessToken, refreshToken, expiresIn) {
    // Store tokens in your database
    // Include expiration time calculation
    const expirationTime = new Date(Date.now() + expiresIn * 1000);
    
    console.log(`Storing tokens for location: ${locationId}`);
    
    // Store in memory for testing
    tokenStorage.set(locationId, {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expirationTime
    });
}

async function getTokens(locationId) {
    // Retrieve tokens from database
    // Return { access_token, refresh_token, expires_at }
    console.log(`Retrieving tokens for location: ${locationId}`);
    
    // Get from memory for testing
    return tokenStorage.get(locationId);
}

async function getStoredTokens(locationId) {
    // Same as getTokens but with different name for consistency
    return await getTokens(locationId);
}

async function storeLocationDetails(locationId, locationData) {
    // Store location information in your database
    console.log(`Storing location details: ${locationData.name}`);
    // Your database implementation here
}

async function createTaskInYourSystem(task) {
    // Create task in your task management system
    console.log(`Creating task: ${task.title}`);
    // Your task creation logic here
}

// Test endpoints
app.get('/contacts', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        // Step 1: Get all pipelines to find the Software Development Pipeline ID
        const pipelinesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/pipelines', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            },
            params: {
                locationId: locationId
            }
        });
        
        const softwarePipeline = pipelinesResponse.data.pipelines.find(
            pipeline => pipeline.name === 'Software Development Pipeline'
        );
        
        if (!softwarePipeline) {
            return res.status(404).json({ error: 'Software Development Pipeline not found' });
        }
        
        // Step 2: Get all opportunities from the Software Development Pipeline
        const opportunitiesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/search', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            },
            params: {
                locationId: locationId,
                pipelineId: softwarePipeline.id,
                limit: 100
            }
        });
        
        // Step 3: Get unique contact IDs from opportunities
        const contactIds = [...new Set(opportunitiesResponse.data.opportunities.map(opp => opp.contact.id))];
        
        // Step 4: Get contact details for each contact ID
        const contactPromises = contactIds.map(async (contactId) => {
            try {
                const contactResponse = await axios.get(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Version': '2021-07-28'
                    },
                    params: {
                        locationId: locationId
                    }
                });
                return contactResponse.data.contact;
            } catch (error) {
                console.error(`Error fetching contact ${contactId}:`, error.response?.data || error.message);
                return null;
            }
        });
        
        const contacts = (await Promise.all(contactPromises)).filter(contact => contact !== null);
        
        res.json({
            success: true,
            location_id: locationId,
            contacts: contacts,
            total: contacts.length,
            pipeline: softwarePipeline.name
        });
        
    } catch (error) {
        console.error('Contacts error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch contacts',
            details: error.response?.data || error.message 
        });
    }
});

app.get('/opportunities', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const opportunitiesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            },
            params: {
                locationId: locationId,
                limit: 10
            }
        });
        
        res.json({
            success: true,
            location_id: locationId,
            opportunities: opportunitiesResponse.data
        });
        
    } catch (error) {
        console.error('Opportunities error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch opportunities', details: error.response?.data || error.message });
    }
});

app.get('/location', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const locationResponse = await axios.get(`https://services.leadconnectorhq.com/locations/${locationId}`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            }
        });
        
        res.json({
            success: true,
            location_id: locationId,
            location: locationResponse.data
        });
        
    } catch (error) {
        console.error('Location error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch location', details: error.response?.data || error.message });
    }
});

app.get('/pipelines', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const pipelinesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/pipelines', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            },
            params: {
                locationId: locationId
            }
        });
        
        res.json({
            success: true,
            location_id: locationId,
            pipelines: pipelinesResponse.data
        });
        
    } catch (error) {
        console.error('Pipelines error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch pipelines', details: error.response?.data || error.message });
    }
});

app.get('/pipeline-tasks/:pipelineName', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const pipelineName = req.params.pipelineName;
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        // First, get all pipelines to find the Software Development Pipeline
        const pipelinesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/pipelines', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            },
            params: {
                locationId: locationId
            }
        });
        
        // Find the specific pipeline
        const targetPipeline = pipelinesResponse.data.pipelines?.find(pipeline => 
            pipeline.name.toLowerCase().includes(pipelineName.toLowerCase())
        );
        
        if (!targetPipeline) {
            return res.status(404).json({ 
                error: 'Pipeline not found', 
                available_pipelines: pipelinesResponse.data.pipelines?.map(p => p.name) || []
            });
        }
        
        // Get opportunities in this pipeline
        const opportunitiesResponse = await axios.get('https://services.leadconnectorhq.com/opportunities/', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            },
            params: {
                locationId: locationId,
                pipelineId: targetPipeline.id,
                limit: 100
            }
        });
        
        // Get tasks for each opportunity
        const opportunities = opportunitiesResponse.data.opportunities || [];
        const allTasks = [];
        
        for (const opportunity of opportunities) {
            try {
                const tasksResponse = await axios.get(`https://services.leadconnectorhq.com/contacts/${opportunity.contactId}/tasks`, {
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Version': '2021-07-28'
                    }
                });
                
                const tasks = tasksResponse.data.tasks || [];
                const opportunityTasks = tasks.map(task => ({
                    ...task,
                    opportunity: {
                        id: opportunity.id,
                        name: opportunity.name,
                        stage: opportunity.pipelineStageId,
                        assignedTo: opportunity.assignedTo,
                        contactId: opportunity.contactId
                    }
                }));
                
                allTasks.push(...opportunityTasks);
            } catch (taskError) {
                console.log(`No tasks found for opportunity ${opportunity.id}`);
            }
        }
        
        res.json({
            success: true,
            location_id: locationId,
            pipeline: targetPipeline,
            opportunities_count: opportunities.length,
            tasks: allTasks,
            tasks_count: allTasks.length
        });
        
    } catch (error) {
        console.error('Pipeline tasks error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch pipeline tasks', details: error.response?.data || error.message });
    }
});

app.get('/tasks', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        // Try direct tasks endpoint first
        try {
            const tasksResponse = await axios.get('https://services.leadconnectorhq.com/tasks/', {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Version': '2021-07-28'
                },
                params: {
                    locationId: locationId,
                    limit: 50
                }
            });
            
            return res.json({
                success: true,
                location_id: locationId,
                tasks: tasksResponse.data.tasks || tasksResponse.data,
                tasks_count: tasksResponse.data.tasks ? tasksResponse.data.tasks.length : 0,
                source: 'direct_tasks_endpoint'
            });
            
        } catch (directTasksError) {
            console.log('Direct tasks endpoint failed, trying contact-based approach');
            
            // Fallback to contact-based tasks
            const contactsResponse = await axios.get('https://services.leadconnectorhq.com/contacts/', {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Version': '2021-07-28'
                },
                params: {
                    locationId: locationId,
                    limit: 10 // Limiting to avoid too many API calls
                }
            });
            
            const contacts = contactsResponse.data.contacts || [];
            const allTasks = [];
            
            for (const contact of contacts) {
                try {
                    const tasksResponse = await axios.get(`https://services.leadconnectorhq.com/contacts/${contact.id}/tasks`, {
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Version': '2021-07-28'
                        }
                    });
                    
                    const tasks = tasksResponse.data.tasks || [];
                    const contactTasks = tasks.map(task => ({
                        ...task,
                        contact: {
                            id: contact.id,
                            name: contact.contactName,
                            email: contact.email,
                            phone: contact.phone
                        }
                    }));
                    
                    allTasks.push(...contactTasks);
                } catch (taskError) {
                    console.log(`No tasks found for contact ${contact.id}`);
                }
            }
            
            return res.json({
                success: true,
                location_id: locationId,
                tasks: allTasks,
                tasks_count: allTasks.length,
                source: 'contact_based_tasks'
            });
        }
        
    } catch (error) {
        console.error('Tasks error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch tasks', details: error.response?.data || error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Debug endpoint to show token details
app.get('/debug/token', (req, res) => {
    try {
        const tokens = getStoredTokens();
        if (!tokens) {
            return res.json({ error: 'No tokens found' });
        }
        
        // Decode JWT to see the payload (for debugging)
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(tokens.access_token);
        
        res.json({
            success: true,
            location_id: tokens.locationId,
            token_expires: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : 'unknown',
            scopes: decoded?.oauthMeta?.scopes || [],
            auth_class: decoded?.authClass || 'unknown',
            source: decoded?.source || 'unknown'
        });
    } catch (error) {
        res.json({ error: 'Failed to decode token', details: error.message });
    }
});

// GHL Task Management Endpoints

// Create a new task
app.post('/contacts/:contactId/tasks', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        const { contactId } = req.params;
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const { title, body, assignedTo, dueDate, completed = false } = req.body;
        
        const response = await axios.post(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks`, {
            title,
            body,
            assignedTo,
            dueDate,
            completed
        }, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            task: response.data.task || response.data,
            contact_id: contactId,
            location_id: locationId
        });
        
    } catch (error) {
        console.error('Task creation error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to create task', 
            details: error.response?.data || error.message 
        });
    }
});

// Get a specific task by ID
app.get('/contacts/:contactId/tasks/:taskId', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        const { contactId, taskId } = req.params;
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const response = await axios.get(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            }
        });
        
        res.json({
            success: true,
            task: response.data.task || response.data,
            contact_id: contactId,
            location_id: locationId
        });
        
    } catch (error) {
        console.error('Task retrieval error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to retrieve task', 
            details: error.response?.data || error.message 
        });
    }
});

// Update a specific task
app.put('/contacts/:contactId/tasks/:taskId', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        const { contactId, taskId } = req.params;
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        const { title, body, assignedTo, dueDate, completed } = req.body;
        
        const response = await axios.put(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks/${taskId}`, {
            title,
            body,
            assignedTo,
            dueDate,
            completed
        }, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            task: response.data.task || response.data,
            contact_id: contactId,
            location_id: locationId
        });
        
    } catch (error) {
        console.error('Task update error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to update task', 
            details: error.response?.data || error.message 
        });
    }
});

// Delete a specific task
app.delete('/contacts/:contactId/tasks/:taskId', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        const { contactId, taskId } = req.params;
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const response = await axios.delete(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            }
        });
        
        res.json({
            success: true,
            message: 'Task deleted successfully',
            contact_id: contactId,
            location_id: locationId
        });
        
    } catch (error) {
        console.error('Task deletion error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to delete task', 
            details: error.response?.data || error.message 
        });
    }
});

// Mark a task as completed
app.put('/contacts/:contactId/tasks/:taskId/complete', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        const { contactId, taskId } = req.params;
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const response = await axios.put(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks/${taskId}/complete`, {}, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            }
        });
        
        res.json({
            success: true,
            task: response.data.task || response.data,
            contact_id: contactId,
            location_id: locationId
        });
        
    } catch (error) {
        console.error('Task completion error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to complete task', 
            details: error.response?.data || error.message 
        });
    }
});

// Get tasks for a specific contact
app.get('/contacts/:contactId/tasks', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const tokens = await getStoredTokens(locationId);
        const { contactId } = req.params;
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        const response = await axios.get(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Version': '2021-07-28'
            }
        });
        
        res.json({
            success: true,
            tasks: response.data.tasks || response.data,
            tasks_count: response.data.tasks ? response.data.tasks.length : 0,
            contact_id: contactId,
            location_id: locationId
        });
        
    } catch (error) {
        console.error('Contact tasks retrieval error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to retrieve contact tasks', 
            details: error.response?.data || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GoHighLevel Integration Server running on port ${PORT}`);
});

module.exports = app; 