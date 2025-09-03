from flask import Flask, request, jsonify, render_template
import requests
import os
from dotenv import load_dotenv

# Load environment variables from a .env file.
# This is important for keeping sensitive information (like API keys) out of the code itself.
load_dotenv()

# Initialize the Flask application.
# Flask is a web framework that helps us build web applications in Python.
# '__name__' tells Flask where to find resources like templates.
app = Flask(__name__)

# Get API base URL and API key from environment variables.
# These are used to connect to the GoHighLevel (GHL) API.
GHL_API_BASE_URL = os.getenv("GHL_API_BASE_URL")
GHL_API_KEY = os.getenv("GHL_API_KEY")

# Define a route for the home page.
# When someone visits the root URL ('/'), this function will be executed.
@app.route('/')
def index():
    # Render the 'index.html' template.
    # This sends the HTML file to the user's browser to display the dashboard.
    return render_template('index.html')

# Define a route to get contacts from the GHL API.
# This route only responds to GET requests.
@app.route('/get_contacts', methods=['GET'])
def get_contacts():
    # Set up the necessary headers for the API request.
    # Headers include authorization (with our API key) and content type.
    headers = {
        "Authorization": f"Bearer {GHL_API_KEY}",
        "Version": "2021-07-28",
        "Content-Type": "application/json"
    }
    try:
        # Make a GET request to the GHL contacts API endpoint.
        # We use an f-string to easily include the base URL.
        response = requests.get(f"{GHL_API_BASE_URL}/contacts/", headers=headers)
        # Check if the request was successful (e.g., status code 200).
        # If not, it will raise an HTTPError.
        response.raise_for_status()
        # If successful, return the JSON response from the API.
        # jsonify converts Python dictionaries to JSON format for web responses.
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        # If there's any error during the request (e.g., network issue, bad response),
        # catch the exception and return an error message with a 500 status code.
        return jsonify({"error": str(e)}), 500

# This block ensures the Flask development server runs only when the script is executed directly.
# 'debug=True' allows for automatic reloading on code changes and provides a debugger.
if __name__ == '__main__':
    app.run(debug=True)