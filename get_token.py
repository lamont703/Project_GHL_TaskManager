import os
import requests
from dotenv import load_dotenv
from urllib.parse import urlencode

# Load environment variables from .env file.
# This is crucial for securely managing API credentials.
load_dotenv()

# --- Configuration ---
# Retrieve client ID and client secret from environment variables.
# These are unique identifiers for your application when interacting with the GoHighLevel API.
GHL_CLIENT_ID = os.getenv("GHL_CLIENT_ID")
GHL_CLIENT_SECRET = os.getenv("GHL_CLIENT_SECRET")

# This must exactly match the redirect URI configured in your GHL App settings.
# After a user authorizes your app, they will be redirected to this URL.
REDIRECT_URI = "http://localhost:3000/oauth/callback"

# Define the API endpoints for token exchange and authorization.
TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token"
AUTH_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation"


def generate_new_token():
    """Guides the user through the OAuth 2.0 process to get a new token."""

    # 1. Construct the Authorization URL
    # These are the permissions your application is requesting from the user.
    # Each scope grants access to specific data or functionalities.
    scopes = [
        "opportunities.readonly",
        "locations/tasks.readonly",
        "users.readonly",
        "locations.readonly"
    ]
    
    # Parameters for the authorization request.
    # 'response_type': Specifies that we expect an authorization code.
    # 'redirect_uri': Where the user will be sent after authorization.
    # 'client_id': Your application's public ID.
    # 'scope': A space-separated list of requested permissions.
    auth_params = {
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "client_id": GHL_CLIENT_ID,
        "scope": ' '.join(scopes)
    }
    
    # Build the full authorization URL by combining the base URL with encoded parameters.
    full_auth_url = f"{AUTH_URL}?{urlencode(auth_params)}"

    # 2. Guide the user through the manual browser step
    print("--- Step 1: Authorize Application ---")
    print("\n1. Copy the following URL.")
    print("2. Paste it into your web browser.")
    print("3. Log in to GoHighLevel and authorize the application.")
    print("4. You will be redirected to a blank page. Copy the ENTIRE URL from your browser's address bar.")
    print("   (It will look like: http://localhost:3000/oauth/callback?code=...)")
    print("\nAuthorization URL:")
    print(full_auth_url)
    
    # 3. Get the authorization code from the user
    # The user manually pastes the full redirect URL they received after authorization.
    redirect_url_with_code = input("\n--- Step 2: Paste the full redirect URL here ---\n> ")
    
    try:
        # Extract the authorization code from the pasted URL.
        # The code is typically found after 'code=' and before the next '&' or end of string.
        auth_code = redirect_url_with_code.split("code=")[1].split("&")[0]
    except IndexError:
        # Handle cases where the 'code=' parameter is not found in the URL.
        print("\nError: Could not find 'code=' in the URL you pasted.")
        print("Please make sure you paste the full URL.")
        return

    # 4. Exchange the authorization code for an access token
    # This payload contains the necessary information to request an access token.
    # 'grant_type': Specifies the type of grant (authorization_code).
    # 'code': The authorization code received in the previous step.
    token_payload = {
        "client_id": GHL_CLIENT_ID,
        "client_secret": GHL_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": REDIRECT_URI,
    }

    print("\n--- Step 3: Exchanging code for a token... ---")
    
    try:
        # Make a POST request to the token URL to exchange the code for tokens.
        response = requests.post(TOKEN_URL, data=token_payload)
        # Check for HTTP errors in the response.
        response.raise_for_status()
        # Parse the JSON response containing the access and refresh tokens.
        token_data = response.json()
        
        # 5. Display the new token
        print("\nSuccess! Here are your new tokens:")
        print(f"\nAccess Token: {token_data['access_token']}")
        print(f"Refresh Token: {token_data['refresh_token']}")
        print(f"\nExpires in: {token_data['expires_in'] / 3600:.1f} hours")
        print("\nIMPORTANT: Copy the new Access Token and paste it into your .env file.")

    except requests.exceptions.RequestException as e:
        # Handle any errors during the token exchange process.
        print(f"\nError exchanging token: {e}")
        print(f"Response Body: {e.response.text}")


# This block ensures that 'generate_new_token()' is called only when the script is executed directly.
if __name__ == "__main__":
    # Check if client ID and secret are set before proceeding.
    if not GHL_CLIENT_ID or not GHL_CLIENT_SECRET:
        print("Error: GHL_CLIENT_ID and GHL_CLIENT_SECRET must be set in your .env file.")
    else:
        generate_new_token()