const express = require('express');
const axios = require('axios');
const router = express.Router();

// Import the token functions from the main server
// Note: In a production environment, you might want to create a separate utilities module
let getStoredTokens;

// Function to set the token functions (called from main server)
function setTokenFunctions(tokenFunctions) {
    getStoredTokens = tokenFunctions.getStoredTokens;
}

// Helper function to create standardized GHL API headers
function createGHLHeaders(accessToken) {
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
    };
    return headers;
}

// Get all pipelines
router.get('/', async (req, res) => {
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

// Get tasks for a specific pipeline
router.get('/:pipelineName/tasks', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const pipelineName = req.params.pipelineName;
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        // First, get all pipelines to find the specific pipeline
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

// Get opportunities for a specific pipeline
router.get('/:pipelineName/opportunities', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const pipelineName = req.params.pipelineName;
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        // First, get all pipelines to find the specific pipeline
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
        
        res.json({
            success: true,
            location_id: locationId,
            pipeline: targetPipeline,
            opportunities: opportunitiesResponse.data.opportunities || [],
            opportunities_count: opportunitiesResponse.data.opportunities ? opportunitiesResponse.data.opportunities.length : 0
        });
        
    } catch (error) {
        console.error('Pipeline opportunities error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch pipeline opportunities', details: error.response?.data || error.message });
    }
});

// Get contacts for a specific pipeline
router.get('/:pipelineName/contacts', async (req, res) => {
    try {
        const locationId = 'QLyYYRoOhCg65lKW9HDX'; // Your location ID
        const pipelineName = req.params.pipelineName;
        const tokens = await getStoredTokens(locationId);
        
        if (!tokens) {
            return res.status(401).json({ error: 'No tokens found. Please re-authenticate.' });
        }
        
        // First, get all pipelines to find the specific pipeline
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
        
        // Get unique contact IDs from opportunities
        const contactIds = [...new Set(opportunitiesResponse.data.opportunities.map(opp => opp.contact.id))];
        
        // Get contact details for each contact ID
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
            pipeline: targetPipeline,
            contacts: contacts,
            total: contacts.length
        });
        
    } catch (error) {
        console.error('Pipeline contacts error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch pipeline contacts',
            details: error.response?.data || error.message 
        });
    }
});

module.exports = { router, setTokenFunctions }; 