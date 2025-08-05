# GoHighLevel Task Manager Integration Guide

## 🚀 Complete Setup Instructions

### Phase 1: GoHighLevel Marketplace App Setup

#### 1. Create Developer Account

- Visit [marketplace.gohighlevel.com](https://marketplace.gohighlevel.com)
- Sign up for a developer account
- Verify your email and complete profile setup

#### 2. Create New App

- Navigate to "My Apps" → "Create App"
- Fill in the required information:

```
App Name: Task Manager Integration
App Description: Sync tasks between GoHighLevel and your task management system
App Type: Public
Distribution Type: Sub Account
Category: Third Party Provider
```

#### 3. Configure App Settings

- **Redirect URI**: `https://yourdomain.com/oauth/callback`
- **Webhook URL**: `https://yourdomain.com/webhooks/ghl`
- **Required Scopes**:
  - `contacts.readonly`
  - `contacts.write`
  - `tasks.readonly`
  - `tasks.write`
  - `calendars.readonly`
  - `calendars.write`
  - `opportunities.readonly`
  - `opportunities.write`
  - `workflows.readonly`
  - `workflows.write`
  - `users.readonly`
  - `locations.readonly`

#### 4. Generate Client Credentials

- Click "Generate Client Credentials"
- **Save these securely** - you'll need them for your backend:
  - Client ID
  - Client Secret

### Phase 2: Backend Server Setup

#### 1. Environment Configuration

Create a `.env` file with the following variables:

```bash
# GoHighLevel API Configuration
GHL_CLIENT_ID=your_client_id_here
GHL_CLIENT_SECRET=your_client_secret_here
GHL_REDIRECT_URI=https://yourdomain.com/oauth/callback
GHL_WEBHOOK_SECRET=your_webhook_secret_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ghl-task-manager
# OR for PostgreSQL:
# DATABASE_URL=postgresql://username:password@localhost:5432/ghl_task_manager

# Security
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=https://app.gohighlevel.com,https://marketplace.gohighlevel.com
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Database Setup

Choose your preferred database and set up the required tables:

**For MongoDB:**

```javascript
// Collections needed:
- ghl_integrations: Store OAuth tokens and location data
- tasks: Store task synchronization data
- sync_logs: Store sync operation logs
```

**For PostgreSQL:**

```sql
-- Create tables
CREATE TABLE ghl_integrations (
    id SERIAL PRIMARY KEY,
    location_id VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    location_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_mappings (
    id SERIAL PRIMARY KEY,
    location_id VARCHAR(255) NOT NULL,
    ghl_task_id VARCHAR(255),
    local_task_id VARCHAR(255),
    sync_direction VARCHAR(20) NOT NULL, -- 'to_ghl', 'from_ghl', 'bidirectional'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    location_id VARCHAR(255) NOT NULL,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Run the Server

```bash
npm start
```

### Phase 3: Frontend Integration

#### 1. Host Configuration Page

- Upload `ghl-config-page.html` to your web server
- Ensure it's accessible via HTTPS
- Update the API endpoints in the HTML to match your backend URLs

#### 2. Add Custom Menu Link in GHL App

- In your marketplace app settings, add a Custom Menu Link
- Set the URL to your hosted configuration page
- This will embed your configuration page in the GoHighLevel interface

### Phase 4: Testing the Integration

#### 1. Test OAuth Flow

- Install your app on a test GoHighLevel account
- The OAuth flow should redirect to your callback URL
- Verify tokens are stored correctly in your database

#### 2. Test Webhook Reception

- Create a test contact in GoHighLevel
- Check if your webhook endpoint receives the event
- Verify that a task is created in your system

#### 3. Test Task Synchronization

- Create a task in your system
- Use the sync API to push it to GoHighLevel
- Verify it appears in the GHL tasks section

### Phase 5: Deployment

#### 1. Production Environment Setup

- Use a production-ready database (MongoDB Atlas, AWS RDS, etc.)
- Set up proper SSL certificates
- Configure environment variables for production

#### 2. Monitoring and Logging

- Implement proper logging for OAuth flows and webhook processing
- Set up monitoring for API rate limits
- Add health check endpoints

#### 3. Security Best Practices

- Use HTTPS for all endpoints
- Implement rate limiting
- Validate all webhook signatures
- Store sensitive data securely

### Phase 6: Publishing to Marketplace

#### 1. App Review Preparation

- Test thoroughly with multiple GoHighLevel accounts
- Prepare documentation and screenshots
- Set up support contact information

#### 2. Submit for Review

- Submit your app through the marketplace dashboard
- Respond to any feedback from the GoHighLevel team
- Make necessary adjustments

#### 3. Go Live

- Once approved, your app will be available in the marketplace
- Monitor for any issues or user feedback
- Provide ongoing support and updates

## 🔧 Integration Features

### Automatic Task Creation

- **New Contacts**: Creates follow-up tasks when contacts are added
- **Opportunities**: Generates follow-up tasks for new deals
- **Appointments**: Creates preparation tasks before meetings

### Two-Way Synchronization

- Tasks created in GoHighLevel sync to your system
- Tasks created in your system can be pushed to GoHighLevel
- Status updates sync in both directions

### Webhook Events Handled

- `ContactCreate`: New contact added
- `TaskCreate`: New task created
- `TaskUpdate`: Task status changed
- `OpportunityCreate`: New opportunity added
- `AppointmentCreate`: New appointment scheduled

## 📊 API Endpoints

### Your Backend Endpoints

- `GET /oauth/callback` - Handle OAuth callback
- `POST /webhooks/ghl` - Receive GoHighLevel webhooks
- `POST /api/sync-tasks` - Sync tasks to GoHighLevel
- `POST /api/integration/status` - Check integration status
- `POST /api/integration/config` - Save configuration
- `GET /health` - Health check

### GoHighLevel API Endpoints Used

- `POST /oauth/token` - Exchange code for tokens
- `GET /contacts/` - Retrieve contacts
- `POST /tasks/` - Create tasks
- `GET /tasks/` - Retrieve tasks
- `GET /locations/{id}` - Get location details

## 🔐 Security Considerations

### Token Management

- Access tokens expire after 24 hours
- Refresh tokens are valid for 1 year
- Implement automatic token refresh logic
- Store tokens securely and encrypted

### Webhook Security

- Verify webhook signatures using HMAC
- Validate all incoming data
- Implement idempotency for webhook processing
- Use HTTPS for all webhook endpoints

### Rate Limiting

- GoHighLevel API has rate limits (100 requests/10 seconds)
- Implement exponential backoff for retries
- Monitor API usage to avoid hitting limits

## 🐛 Troubleshooting

### Common Issues

1. **OAuth Flow Fails**: Check redirect URI configuration
2. **Webhooks Not Received**: Verify webhook URL and SSL certificate
3. **Token Refresh Fails**: Ensure refresh token is valid and not expired
4. **API Rate Limit Hit**: Implement proper rate limiting and retry logic

### Debug Steps

1. Check server logs for error messages
2. Verify environment variables are set correctly
3. Test API endpoints manually using Postman
4. Check database connections and queries

## 📞 Support

For technical support:

- Check the GoHighLevel Developer Documentation
- Join the GoHighLevel Developer Slack Community
- Use the developer support form at developers.gohighlevel.com/support

## 🔄 Updates and Maintenance

### Regular Maintenance

- Monitor API rate limits and usage
- Update dependencies regularly
- Check for GoHighLevel API changes
- Backup database regularly

### Version Updates

- Keep track of GoHighLevel API version changes
- Update OAuth scopes if new features are added
- Test thoroughly before deploying updates

---

**Note**: This integration requires the GoHighLevel Unlimited plan ($297/month) for OAuth 2.0 API access. The Starter plan only provides basic API access without OAuth capabilities.
