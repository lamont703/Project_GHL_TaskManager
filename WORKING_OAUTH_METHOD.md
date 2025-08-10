# Working GoHighLevel OAuth Integration Method

This document outlines the working OAuth flow and pipeline routes for the GoHighLevel integration server.

## Prerequisites

- Node.js installed
- GoHighLevel developer account
- GoHighLevel app configured with correct redirect URI

## Environment Configuration

Create a `.env` file in your project root with the following variables:

```env
GHL_CLIENT_ID=your_client_id_here
GHL_CLIENT_SECRET=your_client_secret_here
GHL_REDIRECT_URI=http://127.0.0.1:3000/oauth/callback
PORT=3000
DATABASE_URL=mongodb://localhost:27017/ghl-integration
JWT_SECRET=your-jwt-secret-key-here-make-it-long-and-random-12345
SESSION_SECRET=your-session-secret-key-here-make-it-long-and-random-67890
GHL_WEBHOOK_SECRET=test-webhook-secret-12345
```

**Important:** Use `http://127.0.0.1:3000/oauth/callback` (not `localhost`) as the redirect URI.

## GoHighLevel App Configuration

1. **Go to GoHighLevel Developer Console:**

   - Visit: https://marketplace.leadconnectorhq.com/developers
   - Sign in with your GoHighLevel account

2. **Configure your app:**
   - **Client ID:** Your app's client ID
   - **Client Secret:** Your app's client secret
   - **Redirect URI:** `http://127.0.0.1:3000/oauth/callback`
   - **Scopes:**
     - `contacts.readonly`
     - `contacts.write`
     - `opportunities.readonly`
     - `opportunities.write`
     - `calendars.readonly`
     - `calendars.write`
     - `locations.readonly`
     - `users.readonly`

## Starting the Server

```bash
node ghl-oauth-server.js
```

The server will start on port 3000.

## OAuth Flow

### Step 1: Initialize OAuth

```bash
curl "http://127.0.0.1:3000/oauth/init"
```

**Response:**

```json
{
  "success": true,
  "auth_url": "https://marketplace.leadconnectorhq.com/oauth/chooselocation?response_type=code&client_id=...&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Foauth%2Fcallback&state=...&scope=...",
  "message": "Visit the auth_url to authenticate with GoHighLevel",
  "state": "..."
}
```

### Step 2: Complete Authentication

1. **Visit the `auth_url`** from the response in your browser
2. **Choose your location** (e.g., `QLyYYRoOhCg65lKW9HDX`)
3. **Authorize the app**

### Step 3: Verify Authentication Status

```bash
curl "http://127.0.0.1:3000/oauth/status"
```

**Response:**

```json
{
  "authenticated": true,
  "expires_at": "2025-08-11T06:56:35.012Z",
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "message": "Authenticated successfully"
}
```

## Available Pipelines

### Get All Pipelines

```bash
curl "http://127.0.0.1:3000/pipelines"
```

**Available Pipelines for Location `QLyYYRoOhCg65lKW9HDX`:**

#### 1. Client Software Development Pipeline

- **ID:** `uR2CMkTiwqoUOYuf8oGR`
- **Stages:** 14 stages from "New Lead" to "Product Delivery"

#### 2. Internal Software Development Pipeline

- **ID:** `45C9XEovSQeO2m0cXaQI`
- **Stages:** 1 stage - "Initial Project Idea"

#### 3. Lost Client Pipeline

- **ID:** `rL1mRIG8mnNx3JDs7XI2`
- **Stages:** 1 stage - "Lost Clients"

## Pipeline-Specific Endpoints

### Get Tasks for a Specific Pipeline

```bash
curl "http://127.0.0.1:3000/pipelines/Client%20Software%20Development%20Pipeline/tasks"
```

**Response:**

```json
{
  "success": true,
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "pipeline": {...},
  "opportunities_count": 5,
  "tasks": [...],
  "tasks_count": 12
}
```

### Get Contacts for a Specific Pipeline

```bash
curl "http://127.0.0.1:3000/pipelines/Client%20Software%20Development%20Pipeline/contacts"
```

**Response:**

```json
{
  "success": true,
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "pipeline": {...},
  "contacts": [...],
  "total": 8
}
```

### Get Opportunities for a Specific Pipeline

```bash
curl "http://127.0.0.1:3000/pipelines/Client%20Software%20Development%20Pipeline/opportunities"
```

**Response:**

```json
{
  "success": true,
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "pipeline": {...},
  "opportunities": [...],
  "opportunities_count": 5
}
```

## Other Available Endpoints

### Get All Opportunities

```bash
curl "http://127.0.0.1:3000/opportunities"
```

### Get Location Details

```bash
curl "http://127.0.0.1:3000/location"
```

### Get All Tasks

```bash
curl "http://127.0.0.1:3000/tasks"
```

### Health Check

```bash
curl "http://127.0.0.1:3000/health"
```

## Troubleshooting

### Common Issues

#### 1. "Invalid client: redirect_uri does not match client value"

**Solution:** Ensure your GoHighLevel app's redirect URI exactly matches `http://127.0.0.1:3000/oauth/callback`

#### 2. "No tokens found. Please re-authenticate."

**Solution:** Complete the OAuth flow again by visiting `/oauth/init`

#### 3. CORS Issues

**Solution:** The server includes CORS headers for all routes

### Token Management

- **Access Token:** Valid for 24 hours (86,399 seconds)
- **Refresh Token:** Valid for 1 year
- **Auto-refresh:** Implemented in the server

## Architecture

### Route Structure

```
/pipelines                    - Pipeline routes module
├── /                        - Get all pipelines
├── /:pipelineName/tasks     - Get tasks for specific pipeline
├── /:pipelineName/contacts  - Get contacts for specific pipeline
└── /:pipelineName/opportunities - Get opportunities for specific pipeline
```

### File Organization

```
ghl-oauth-server.js          - Main server file
routes/
├── pipelines.js             - Pipeline-specific routes
└── README.md               - Route documentation
```

## Security Notes

- All endpoints require valid authentication tokens
- Webhook signature verification implemented
- CORS enabled for development
- Environment variables for sensitive data

## Development Workflow

1. **Start server:** `node ghl-oauth-server.js`
2. **Authenticate:** Visit `/oauth/init` URL
3. **Test endpoints:** Use the various pipeline and data endpoints
4. **Monitor logs:** Check server console for debugging information

## Production Considerations

- Replace in-memory token storage with database
- Implement proper error logging
- Add rate limiting
- Use HTTPS in production
- Implement proper session management
- Add monitoring and health checks
