require('dotenv').config(); // Load environment variables from .env file
const fetch = require('node-fetch'); // For making HTTP requests
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Google Gemini API

// --- Configuration ---
const GHL_API_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_PIPELINE_NAME = "Client Software Development Pipeline"; // Set your default pipeline here

// Configure the Gemini API
let geminiModel;
if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
} else {
    console.error("Error: GEMINI_API_KEY not found in .env file.");
    // In a Node.js context, you might want to throw an error or exit
    // process.exit(1);
}

// --- GHL API Functions ---

async function get_all_pipelines() {
    // Fetches all pipelines for the configured location.
    const headers = {
        "Authorization": `Bearer ${GHL_ACCESS_TOKEN}`,
        "Version": "2021-07-28",
        "Accept": "application/json"
    };
    const pipelines_url = `${GHL_API_BASE_URL}/opportunities/pipelines`;
    const params = new URLSearchParams({"locationId": GHL_LOCATION_ID});

    try {
        const response = await fetch(`${pipelines_url}?${params.toString()}`, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.pipelines || [];
    } catch (e) {
        console.error(`Error fetching pipelines: ${e}`);
        if (e.response) {
            console.error(`Response Body: ${await e.response.text()}`);
        }
        return null;
    }
}

async function get_ghl_opportunities(pipeline_id, status) {
    // Fetches opportunities and their tasks from GHL for a specific pipeline.
    const headers = {
        "Authorization": `Bearer ${GHL_ACCESS_TOKEN}`,
        "Version": "2021-07-28",
        "Accept": "application/json"
    };
    
    const params = new URLSearchParams({
        "location_id": GHL_LOCATION_ID,
        "getTasks": "true",
        "pipeline_id": pipeline_id,
        "status": status
    });
    
    const search_url = `${GHL_API_BASE_URL}/opportunities/search`;
    
    console.log(`Querying GHL API for pipeline ${pipeline_id}...`);

    try {
        const response = await fetch(`${search_url}?${params.toString()}`, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.opportunities || [];
    } catch (e) {
        console.error(`Error fetching data from GHL: ${e}`);
        if (e.response) {
            console.error(`Response Body: ${await e.response.text()}`);
        }
        return [];
    }
}

// --- Gemini NLP Functions ---

async function get_interpretation_from_gemini(query) {
    // Uses Gemini to interpret a natural language query and return structured filters.
    if (!geminiModel) {
        console.error("Error: Gemini model not available.");
        return null;
    }
    
    const prompt = `
    You are an intelligent assistant. Your task is to interpret a user's query about GoHighLevel opportunities and extract filtering criteria.
    The user's query is: "${query}"
    
    Based on this query, identify the following optional keys: 'opportunity_name' (can be a string or a list of strings), 'pipeline_name', and 'task_limit' (an integer).
    If the user asks for 'a task' or 'one task', set task_limit to 1.
    The 'status' is also optional and defaults to 'open'.
    
    Return the result as a JSON object. Here are some examples:
    
    Query: "a task for project techceo"
    Response: {{'opportunity_name': 'Project TechCEO', 'task_limit': 1}}

    Query: "tasks for project A and project B"
    Response: {{'opportunity_name': ['Project A', 'Project B']}}

    Query: "show me 3 tasks for project voice agent in the internal pipeline"
    Response: {{'pipeline_name': 'Internal Pipeline', 'opportunity_name': 'Project Voice Agent', 'task_limit': 3}}
    
    Query: "show me all tasks in the client pipeline"
    Response: {{'pipeline_name': 'Client Pipeline'}}

    If you cannot determine any criteria, return an empty JSON object: {{}}
    `;
    
    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const json_str = response.text().trim().replace(/```json\n|```/g, '').trim();
        return JSON.parse(json_str);
    } catch (e) {
        console.error(`Error interpreting query with Gemini: ${e}`);
        return {};
    }
}

// --- Main Execution Logic (now a function to be called by API) ---

async function process_query(user_query) {
    const output_lines = [];

    if (!user_query) {
        output_lines.push("No query provided.");
        return output_lines.join("\n");
    }

    // 1. Get structured filters from Gemini
    const interp = await get_interpretation_from_gemini(user_query);
    output_lines.push(`Gemini interpretation: ${JSON.stringify(interp)}`);

    // 2. Determine the pipeline to use (default or from query)
    let pipeline_name;
    if (interp && interp.pipeline_name) {
        pipeline_name = interp.pipeline_name;
    } else {
        output_lines.push(`No pipeline specified in query, using default: '${DEFAULT_PIPELINE_NAME}'`);
        pipeline_name = DEFAULT_PIPELINE_NAME;
    }

    // 3. Get all available pipelines from GHL to find the ID
    output_lines.push("Fetching all available pipelines...");
    const all_pipelines = await get_all_pipelines();
    if (all_pipelines === null) {
        output_lines.push("Failed to fetch pipelines.");
        return output_lines.join("\n");
    }
    
    const pipeline_name_to_id = {};
    for (const p of all_pipelines) {
        if (p.name && p.id) {
            pipeline_name_to_id[p.name.toLowerCase()] = p.id;
        }
    }
    const pipeline_id = pipeline_name_to_id[pipeline_name.toLowerCase()];

    if (!pipeline_id) {
        output_lines.push(`Error: Could not find a pipeline with the name '${pipeline_name}'.`);
        const available_names = all_pipelines.map(p => p.name);
        output_lines.push(`Available pipelines are: ${available_names.join(', ')}`);
        return output_lines.join("\n");
    }

    output_lines.push(`Found Pipeline ID for '${pipeline_name}': ${pipeline_id}`);
    const status = (interp && interp.status) ? interp.status : "open";
    const opportunities = await get_ghl_opportunities(pipeline_id, status);

    // 4. Filter for a specific opportunity if requested
    if (interp && interp.opportunity_name) {
        let opp_names = interp.opportunity_name;
        if (!Array.isArray(opp_names)) {
            opp_names = [opp_names];
        }
        
        const lowercase_opp_names = opp_names.map(name => name.toLowerCase());
        output_lines.push(`Filtering for opportunities matching: ${opp_names.join(', ')}...`);
        
        const filtered_opps = opportunities.filter(o => 
            lowercase_opp_names.some(name => o.name && o.name.toLowerCase().includes(name))
        );

        opportunities.splice(0, opportunities.length, ...filtered_opps); // Replace content of opportunities array
        if (opportunities.length === 0) {
            output_lines.push(`Could not find any opportunity matching your criteria.`);
            return output_lines.join("\n");
        }
    } else {
        output_lines.push("No specific opportunity requested, showing tasks for all opportunities in the pipeline.");
    }

    // 5. Process and display tasks
    output_lines.push("\n--- Tasks from Opportunities ---");
    let task_found = false;
    const task_limit = (interp && interp.task_limit) ? interp.task_limit : undefined;
    
    for (const opp of opportunities) {
        if (opp.tasks && opp.tasks.length > 0) {
            const incomplete_tasks = opp.tasks.filter(t => !t.completed);
            
            if (incomplete_tasks.length === 0) {
                continue;
            }

            task_found = true;
            output_lines.push(`\nOpportunity: ${opp.name || 'N/A'} (Pipeline: ${opp.pipelineName || 'N/A'})`);
            
            let tasks_to_show = incomplete_tasks;
            if (task_limit !== undefined) {
                output_lines.push(`(Showing up to ${task_limit} task(s) as requested)`);
                tasks_to_show = incomplete_tasks.slice(0, task_limit);
            }
            
            for (const task of tasks_to_show) {
                output_lines.push(`  - [ ] Task: ${task.title || 'No Title'}`);
                output_lines.push(`    > Due: ${task.dueDate || 'N/A'}`);
            }
        }
    }
        
    if (!task_found) {
        output_lines.push("No incomplete tasks found for the given criteria.");
    }

    return output_lines.join("\n");
}

// Export the function for use in other modules (e.g., an Express server)
module.exports = { process_query };