import os
import requests
import google.generativeai as genai
from dotenv import load_dotenv
import json

# Load environment variables from .env file.
# This is a common practice to keep sensitive data (like API keys) out of your code.
load_dotenv()

# --- Configuration ---
# Base URL for the GoHighLevel (GHL) API.
GHL_API_BASE_URL = "https://services.leadconnectorhq.com"
# Your GHL access token, loaded from environment variables.
GHL_ACCESS_TOKEN = os.getenv("GHL_ACCESS_TOKEN")
# Your GHL location ID, also from environment variables.
GHL_LOCATION_ID = os.getenv("GHL_LOCATION_ID")
# Your Gemini API key for natural language processing.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Default pipeline name to use if not specified in the user's query.
DEFAULT_PIPELINE_NAME = "Client Software Development Pipeline" # Set your default pipeline here

# Configure the Gemini API with your API key.
# This checks if the API key is available before proceeding.
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    # If the API key is missing, print an error and exit.
    # In a real web application, you might handle this more gracefully (e.g., return an error page).
    print("Error: GEMINI_API_KEY not found in .env file.")
    exit()

# --- GHL API Functions ---

def get_all_pipelines():
    """Fetches all pipelines for the configured location from the GHL API."""
    # Set up headers for the API request, including authorization and API version.
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": "2021-07-28",
        "Accept": "application/json"
    }
    # Construct the URL for fetching pipelines.
    pipelines_url = f"{GHL_API_BASE_URL}/opportunities/pipelines"
    # Parameters for the request, specifying the location ID.
    params = {"locationId": GHL_LOCATION_ID}

    try:
        # Make a GET request to the GHL API.
        response = requests.get(pipelines_url, headers=headers, params=params)
        # Raise an HTTPError for bad responses (4xx or 5xx).
        response.raise_for_status()
        # Return the list of pipelines from the JSON response.
        return response.json().get("pipelines", [])
    except requests.exceptions.RequestException as e:
        # Catch any request-related errors (e.g., network issues, invalid responses).
        print(f"Error fetching pipelines: {e}") 
        # If there's a response object, print its text for more details.
        if hasattr(e, 'response') and e.response:
            print(f"Response Body: {e.response.text}")
        return None

def get_ghl_opportunities(pipeline_id, status):
    """Fetches opportunities and their tasks from GHL for a specific pipeline and status."""
    # Set up headers for the API request, similar to get_all_pipelines.
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": "2021-07-28",
        "Accept": "application/json"
    }
    
    # Parameters for fetching opportunities.
    # 'location_id': Specifies the location.
    # 'getTasks': Set to "true" to include tasks with opportunities.
    # 'pipeline_id': Filters opportunities by a specific pipeline.
    # 'status': Filters opportunities by their status (e.g., 'open', 'won', 'lost').
    params = {
        "location_id": GHL_LOCATION_ID,
        "getTasks": "true",
        "pipeline_id": pipeline_id,
        "status": status
    }
    
    # Construct the URL for searching opportunities.
    search_url = f"{GHL_API_BASE_URL}/opportunities/search"
    
    # Print a message indicating the query is being made.
    print(f"Querying GHL API for pipeline {pipeline_id}...")

    try:
        # Make a GET request to the GHL API.
        response = requests.get(search_url, headers=headers, params=params)
        # Raise an HTTPError for bad responses.
        response.raise_for_status()
        # Return the list of opportunities from the JSON response.
        return response.json().get("opportunities", [])
    except requests.exceptions.RequestException as e:
        # Catch any request-related errors.
        print(f"Error fetching data from GHL: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response Body: {e.response.text}")
        return []

# --- Gemini NLP Functions ---

def get_interpretation_from_gemini(query):
    """Uses Gemini to interpret a natural language query and return structured filters."""
    # Check if the Gemini model is available.
    if not genai.get_model("models/gemini-2.5-flash"):
        print("Error: Gemini model not available.")
        return None
        
    # Initialize the Gemini generative model.
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Construct the prompt for Gemini.
    # This prompt instructs Gemini on how to interpret the user's query and what format to return.
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
        # Generate content using the Gemini model based on the prompt.
        response = model.generate_content(prompt)
        # Extract the JSON string from Gemini's response and clean it up.
        json_str = response.text.strip().replace("```json", "").replace("```", "").strip()
        # Parse the JSON string into a Python dictionary.
        return json.loads(json_str)
    except Exception as e:
        # Catch any errors during the interpretation or JSON parsing.
        print(f"Error interpreting query with Gemini: {e}")
        return {{}}

# --- Main Execution Logic (now a function to be called by API) ---

def process_query(user_query):
    # Initialize a list to store output messages.
    output_lines = []

    # If no query is provided, return a message.
    if not user_query:
        output_lines.append("No query provided.")
        return "\n".join(output_lines)

    # 1. Get structured filters from Gemini
    # Call Gemini to interpret the user's natural language query.
    interp = get_interpretation_from_gemini(user_query)
    output_lines.append(f"Gemini interpretation: {interp}")

    # 2. Determine the pipeline to use (default or from query)
    # Check if Gemini identified a specific pipeline name.
    if interp.get("pipeline_name"):
        pipeline_name = interp["pipeline_name"]
    else:
        # If not, use the default pipeline name.
        output_lines.append(f"No pipeline specified in query, using default: '{DEFAULT_PIPELINE_NAME}'")
        pipeline_name = DEFAULT_PIPELINE_NAME

    # 3. Get all available pipelines from GHL to find the ID
    output_lines.append("Fetching all available pipelines...")
    all_pipelines = get_all_pipelines()
    if all_pipelines is None:
        output_lines.append("Failed to fetch pipelines.")
        return "\n".join(output_lines)
    
    # Create a dictionary mapping lowercase pipeline names to their IDs for easy lookup.
    # This uses a dictionary comprehension, which is a concise way to create dictionaries.
    pipeline_name_to_id = {p["name"].lower(): p["id"] for p in all_pipelines}
    # Get the ID for the determined pipeline name.
    pipeline_id = pipeline_name_to_id.get(pipeline_name.lower())

    # If the pipeline ID is not found, print an error and list available pipelines.
    if not pipeline_id:
        output_lines.append(f"Error: Could not find a pipeline with the name '{pipeline_name}'.")
        # Extract available pipeline names for the user.
        available_names = [p.get('name') for p in all_pipelines]
        output_lines.append(f"Available pipelines are: {available_names}")
        return "\n".join(output_lines)

    output_lines.append(f"Found Pipeline ID for '{pipeline_name}': {pipeline_id}")
    # Get the status from Gemini's interpretation, defaulting to 'open'.
    status = interp.get("status", "open")
    # Fetch opportunities from GHL using the identified pipeline ID and status.
    opportunities = get_ghl_opportunities(pipeline_id, status)

    # 4. Filter for a specific opportunity if requested
    # Check if Gemini identified specific opportunity names.
    if interp.get("opportunity_name"):
        opp_names = interp["opportunity_name"]
        # Ensure opp_names is a list, even if only one name was provided.
        if not isinstance(opp_names, list):
            opp_names = [opp_names]
        
        # Convert opportunity names to lowercase for case-insensitive matching.
        lowercase_opp_names = [name.lower() for name in opp_names]
        output_lines.append(f"Filtering for opportunities matching: {opp_names}...")
        
        # Filter the opportunities list.
        # This is a list comprehension: it creates a new list by iterating through 'opportunities'
        # and including only those where the opportunity name (converted to lowercase) contains
        # any of the requested lowercase opportunity names.
        filtered_opps = [o for o in opportunities if any(name in o.get("name", "").lower() for name in lowercase_opp_names)]

        opportunities = filtered_opps
        # If no opportunities match the filter, inform the user.
        if not opportunities:
            output_lines.append(f"Could not find any opportunity matching your criteria.")
            return "\n".join(output_lines)
    else:
        output_lines.append("No specific opportunity requested, showing tasks for all opportunities in the pipeline.")

    # 5. Process and display tasks
    output_lines.append("\n--- Tasks from Opportunities ---")
    task_found = False
    # Get the task limit from Gemini's interpretation.
    task_limit = interp.get("task_limit")
    
    # Iterate through each opportunity.
    for opp in opportunities:
        # Check if the opportunity has any tasks.
        if opp.get("tasks"):
            # Filter for incomplete tasks.
            # This is another list comprehension: it creates a list of tasks that are not marked as 'completed'.
            incomplete_tasks = [t for t in opp["tasks"] if not t.get("completed")]
            
            # If there are no incomplete tasks for this opportunity, skip to the next one.
            if not incomplete_tasks:
                continue

            task_found = True
            output_lines.append(f"\nOpportunity: {opp.get('name', 'N/A')} (Pipeline: {opp.get('pipelineName', 'N/A')})")
            
            tasks_to_show = incomplete_tasks
            # If a task limit was specified, slice the list to show only up to that limit.
            if task_limit:
                output_lines.append(f"(Showing up to {task_limit} task(s) as requested)")
                tasks_to_show = incomplete_tasks[:task_limit]
            
            # Iterate through the tasks to display them.
            for task in tasks_to_show:
                output_lines.append(f"  - [ ] Task: {task.get('title', 'No Title')}")
                output_lines.append(f"    > Due: {task.get('dueDate', 'N/A')}")
        
    # If no incomplete tasks were found across all opportunities, inform the user.
    if not task_found:
        output_lines.append("No incomplete tasks found for the given criteria.")

    # Join all output lines into a single string and return it.
    return "\n".join(output_lines)