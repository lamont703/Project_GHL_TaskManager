import os
import requests
import google.generativeai as genai
from dotenv import load_dotenv
import json

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
GHL_API_BASE_URL = "https://services.leadconnectorhq.com"
GHL_ACCESS_TOKEN = os.getenv("GHL_ACCESS_TOKEN")
GHL_LOCATION_ID = os.getenv("GHL_LOCATION_ID")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEFAULT_PIPELINE_NAME = "Client Software Development Pipeline" # Set your default pipeline here

# Configure the Gemini API
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    # In a web context, we might not want to exit, but return an error
    # For now, keep exit for clarity during development
    print("Error: GEMINI_API_KEY not found in .env file.")
    exit()

# --- GHL API Functions ---

def get_all_pipelines():
    """Fetches all pipelines for the configured location."""
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": "2021-07-28",
        "Accept": "application/json"
    }
    pipelines_url = f"{GHL_API_BASE_URL}/opportunities/pipelines"
    params = {"locationId": GHL_LOCATION_ID}

    try:
        response = requests.get(pipelines_url, headers=headers, params=params)
        response.raise_for_status()
        return response.json().get("pipelines", [])
    except requests.exceptions.RequestException as e:
        # In a web context, log this error, don't print directly to stdout
        print(f"Error fetching pipelines: {e}") 
        if hasattr(e, 'response') and e.response:
            print(f"Response Body: {e.response.text}")
        return None

def get_ghl_opportunities(pipeline_id, status):
    """Fetches opportunities and their tasks from GHL for a specific pipeline."""
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": "2021-07-28",
        "Accept": "application/json"
    }
    
    params = {
        "location_id": GHL_LOCATION_ID,
        "getTasks": "true",
        "pipeline_id": pipeline_id,
        "status": status
    }
    
    search_url = f"{GHL_API_BASE_URL}/opportunities/search"
    
    # In a web context, log this, don't print directly
    print(f"Querying GHL API for pipeline {pipeline_id}...")

    try:
        response = requests.get(search_url, headers=headers, params=params)
        response.raise_for_status()
        return response.json().get("opportunities", [])
    except requests.exceptions.RequestException as e:
        # In a web context, log this error
        print(f"Error fetching data from GHL: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response Body: {e.response.text}")
        return []

# --- Gemini NLP Functions ---

def get_interpretation_from_gemini(query):
    """Uses Gemini to interpret a natural language query and return structured filters."""
    if not genai.get_model("models/gemini-2.5-flash"):
        # In a web context, log this error
        print("Error: Gemini model not available.")
        return None
        
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    You are an intelligent assistant. Your task is to interpret a user's query about GoHighLevel opportunities and extract filtering criteria.
    The user's query is: "{query}"
    
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
    """
    
    try:
        response = model.generate_content(prompt)
        json_str = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(json_str)
    except Exception as e:
        # In a web context, log this error
        print(f"Error interpreting query with Gemini: {e}")
        return {{}}

# --- Main Execution Logic (now a function to be called by API) ---

def process_query(user_query):
    output_lines = []

    if not user_query:
        output_lines.append("No query provided.")
        return "\n".join(output_lines)

    # 1. Get structured filters from Gemini
    interp = get_interpretation_from_gemini(user_query)
    output_lines.append(f"Gemini interpretation: {interp}")

    # 2. Determine the pipeline to use (default or from query)
    if interp.get("pipeline_name"):
        pipeline_name = interp["pipeline_name"]
    else:
        output_lines.append(f"No pipeline specified in query, using default: '{DEFAULT_PIPELINE_NAME}'")
        pipeline_name = DEFAULT_PIPELINE_NAME

    # 3. Get all available pipelines from GHL to find the ID
    output_lines.append("Fetching all available pipelines...")
    all_pipelines = get_all_pipelines()
    if all_pipelines is None:
        output_lines.append("Failed to fetch pipelines.")
        return "\n".join(output_lines)
    
    pipeline_name_to_id = {p["name"].lower(): p["id"] for p in all_pipelines}
    pipeline_id = pipeline_name_to_id.get(pipeline_name.lower())

    if not pipeline_id:
        output_lines.append(f"Error: Could not find a pipeline with the name '{pipeline_name}'.")
        available_names = [p.get('name') for p in all_pipelines]
        output_lines.append(f"Available pipelines are: {available_names}")
        return "\n".join(output_lines)

    output_lines.append(f"Found Pipeline ID for '{pipeline_name}': {pipeline_id}")
    status = interp.get("status", "open")
    opportunities = get_ghl_opportunities(pipeline_id, status)

    # 4. Filter for a specific opportunity if requested
    if interp.get("opportunity_name"):
        opp_names = interp["opportunity_name"]
        if not isinstance(opp_names, list):
            opp_names = [opp_names]
        
        lowercase_opp_names = [name.lower() for name in opp_names]
        output_lines.append(f"Filtering for opportunities matching: {opp_names}...")
        
        filtered_opps = [o for o in opportunities if any(name in o.get("name", "").lower() for name in lowercase_opp_names)]

        opportunities = filtered_opps
        if not opportunities:
            output_lines.append(f"Could not find any opportunity matching your criteria.")
            return "\n".join(output_lines)
    else:
        output_lines.append("No specific opportunity requested, showing tasks for all opportunities in the pipeline.")

    # 5. Process and display tasks
    output_lines.append("\n--- Tasks from Opportunities ---")
    task_found = False
    task_limit = interp.get("task_limit")
    
    for opp in opportunities:
        if opp.get("tasks"):
            incomplete_tasks = [t for t in opp["tasks"] if not t.get("completed")]
            
            if not incomplete_tasks:
                continue

            task_found = True
            output_lines.append(f"\nOpportunity: {opp.get('name', 'N/A')} (Pipeline: {opp.get('pipelineName', 'N/A')})")
            
            tasks_to_show = incomplete_tasks
            if task_limit:
                output_lines.append(f"(Showing up to {task_limit} task(s) as requested)")
                tasks_to_show = incomplete_tasks[:task_limit]
            
            for task in tasks_to_show:
                output_lines.append(f"  - [ ] Task: {task.get('title', 'No Title')}")
                output_lines.append(f"    > Due: {task.get('dueDate', 'N/A')}")
        
    if not task_found:
        output_lines.append("No incomplete tasks found for the given criteria.")

    return "\n".join(output_lines)
