# GoHighLevel API Working Endpoints

This document tracks the working API endpoints we've discovered during testing with the GoHighLevel integration.

## ✅ Working Endpoints

### 1. OAuth Authentication
- **Endpoint:** `POST https://services.leadconnectorhq.com/oauth/token`
- **Method:** POST
- **Purpose:** Exchange OAuth authorization code for bearer token
- **Status:** ✅ Working
- **Notes:** Successfully exchanges OAuth code for access_token, refresh_token, and expires_in

### 2. Business Location Details
- **Endpoint:** `GET https://services.leadconnectorhq.com/locations/{locationId}`
- **Method:** GET
- **Purpose:** Retrieve business location information
- **Status:** ✅ Working
- **Example:** `https://services.leadconnectorhq.com/locations/QLyYYRoOhCg65lKW9HDX`
- **Response:** Returns location details including company info, address, contact details, social media, and business settings

### 3. Local OAuth Server Endpoints
- **Base URL:** `http://localhost:3000`

#### 3.1 OAuth Initialization
- **Endpoint:** `GET /oauth/init`
- **Method:** GET
- **Purpose:** Generate OAuth authorization URL
- **Status:** ✅ Working
- **Response:** Returns auth_url, state, and success status

#### 3.2 OAuth Status Check
- **Endpoint:** `GET /oauth/status`
- **Method:** GET
- **Purpose:** Check OAuth authentication status
- **Status:** ✅ Working
- **Response:** Returns authentication status, token expiration, and location ID

#### 3.3 OAuth Callback
- **Endpoint:** `GET /oauth/callback`
- **Method:** GET
- **Purpose:** Handle OAuth callback and exchange code for tokens
- **Status:** ✅ Working
- **Parameters:** Requires `code` and `state` query parameters

## ❌ Non-Working Endpoints

### 1. Legacy REST API Endpoints
- **Base URL:** `https://rest.gohighlevel.com`
- **Status:** ❌ Deprecated - Returns "Unauthorized, Switch to the new API token"

### 2. Incorrect Location-Based Endpoints
- **Pipelines:** `GET /locations/{locationId}/pipelines` - 404 Not Found
- **Opportunities:** `GET /locations/{locationId}/opportunities` - 404 Not Found
- **Workflows:** `GET /locations/{locationId}/workflows` - 404 Not Found

### 3. Incorrect Company-Based Endpoints
- **Company Pipelines:** `GET /companies/{companyId}/pipelines` - 404 Not Found

## 🔄 Endpoints to Test (API 2.0 Documentation)

Based on GoHighLevel API 2.0 documentation, these endpoints should work but need fresh authentication:

### 1. Pipelines
- **Endpoint:** `GET https://services.leadconnectorhq.com/opportunities/pipelines`
- **Required Parameters:** `locationId` (query parameter)
- **Required Headers:** `Version: 2021-07-28`
- **Status:** 🔄 Needs fresh token to test

## 📋 Authentication Requirements

### Working Token Format
- **Type:** Bearer Token
- **Source:** OAuth 2.0 flow via `https://services.leadconnectorhq.com/oauth/token`
- **Lifetime:** ~24 hours (86,399 seconds)
- **Required Headers:** `Version: 2021-07-28`

### OAuth Flow
1. Call `/oauth/init` to get authorization URL
2. Visit authorization URL to authenticate
3. Exchange authorization code for tokens via `/oauth/token`
4. Use bearer token in API calls

## 🚨 Current Issues

1. **Token Expiration:** Bearer tokens expire after ~24 hours
2. **Endpoint Discovery:** Many endpoints return 404, suggesting different URL structure
3. **API Version:** Need to ensure `Version: 2021-07-28` header is included

## 📝 Notes

- The `services.leadconnectorhq.com` domain is working for authenticated endpoints
- The `rest.gohighlevel.com` domain is deprecated
- Location ID format: `QLyYYRoOhCg65lKW9HDX`
- Company ID format: `Hz44NDQkhm7P4bftZHOX`
- OAuth scopes include: contacts, opportunities, calendars, tasks, users, locations, workflows

---

*Last Updated: January 2025*
*Tested with GoHighLevel API 2.0* 