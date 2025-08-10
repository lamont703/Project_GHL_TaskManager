# 🎯 Pipeline Tasks Integration Guide

## Overview

Your standalone `get-tasks-standalone.js` script has been successfully integrated into your main server! Now your dashboard can automatically display rich pipeline task data with opportunity context, just like the standalone script provided.

## 🚀 What's New

### 1. **Enhanced `/tasks` Endpoint**

- **Primary**: Now tries to fetch rich pipeline data first
- **Fallback**: Falls back to standard task methods if pipeline search fails
- **Rich Context**: Includes opportunity title, stage, value, and status
- **Metadata**: Shows data source and method information

### 2. **New `/pipeline-tasks-rich` Endpoint**

- **Dedicated**: Specifically for your target pipeline
- **Rich Data**: Full opportunity context for every task
- **Pipeline Focus**: Targets "Client Software Development Pipeline"
- **No Fallback**: Pure pipeline data only

### 3. **Dashboard Integration**

- **Automatic**: Dashboard now loads rich pipeline data by default
- **Fallback**: Gracefully falls back to standard data if needed
- **Refresh Button**: New "🔄 Refresh Pipeline" button for manual updates
- **Rich Display**: Shows opportunity context in each task

## 🔧 How It Works

### Data Flow

```
Dashboard → /pipeline-tasks-rich (primary)
     ↓
Fallback to /tasks (enhanced)
     ↓
Fallback to standard methods
```

### API Calls

1. **Primary**: `GET /pipeline-tasks-rich`

   - Searches opportunities in your target pipeline
   - Uses `getTasks: true` parameter for rich data
   - Returns tasks with full opportunity context

2. **Enhanced**: `GET /tasks`
   - Tries pipeline search first
   - Falls back to standard task methods
   - Always includes source and method metadata

## 📊 Data Structure

### Rich Task Format

```javascript
{
    id: "task_id",
    title: "Task Title",
    description: "Task Description",
    dueDate: "2024-01-15",
    priority: "high|medium|low",
    status: "incomplete|in-progress|complete",
    owner: "Assigned User",

    // Rich Opportunity Context
    opportunityId: "opp_id",
    opportunityTitle: "Project Name",
    opportunityStage: "Discovery|Proposal|Development",
    opportunityValue: 25000,
    opportunityStatus: "Active|Pending|Won",
    pipelineId: "pipeline_id",

    // Metadata
    source: "pipeline_opportunities_search",
    method: "Searched opportunities with tasks in pipeline: Client Software Development Pipeline"
}
```

## 🎨 Dashboard Features

### 1. **User-Categorized Tasks**

- Tasks automatically grouped by assigned user
- Shows completion counts for each user
- Clean, organized layout

### 2. **Opportunity Context**

- 🎯 Opportunity title and stage
- 💰 Project value display
- 📊 Status indicators
- Visual badges and styling

### 3. **Data Source Information**

- Shows where data came from
- Displays the method used
- Pipeline information
- Total task counts

### 4. **Refresh Capability**

- Manual refresh button
- Real-time data updates
- Fallback handling

## 🧪 Testing

### 1. **Test the Integration**

```bash
node test-integration.js
```

### 2. **Test the Dashboard**

- Open `test-dashboard.html` for isolated testing
- Open `dashboard.html` for full integration testing
- Check browser console for detailed logs

### 3. **Verify Data**

- Tasks should be grouped by user
- Opportunity context should be visible
- Data source info should display
- Refresh button should work

## 🔍 Troubleshooting

### Common Issues

#### 1. **No Pipeline Data**

- Check if you're authenticated with GoHighLevel
- Verify your pipeline ID is correct
- Check if opportunities have tasks

#### 2. **Fallback to Standard Data**

- This is normal if pipeline search fails
- Check server logs for specific errors
- Verify API permissions

#### 3. **Dashboard Not Loading**

- Ensure server is running (`npm start`)
- Check browser console for errors
- Verify OAuth tokens are valid

### Debug Steps

1. **Check Server Logs**

   - Look for pipeline search attempts
   - Check for API errors
   - Verify data transformation

2. **Check Browser Console**

   - Look for fetch errors
   - Check data loading logs
   - Verify task rendering

3. **Test Endpoints Directly**
   - Test `/pipeline-tasks-rich` endpoint
   - Test `/tasks` endpoint
   - Check response data structure

## 🚀 Next Steps

### 1. **Start Your Server**

```bash
npm start
```

### 2. **Test the Integration**

```bash
node test-integration.js
```

### 3. **Open Your Dashboard**

- Open `dashboard.html` in your browser
- Click "🔄 Refresh Pipeline" button
- Verify rich data is displayed

### 4. **Monitor and Optimize**

- Check server performance
- Monitor API rate limits
- Optimize data loading if needed

## 📚 API Reference

### Endpoints

#### `GET /pipeline-tasks-rich`

- **Purpose**: Fetch rich pipeline tasks
- **Response**: Tasks with full opportunity context
- **Fallback**: None (pure pipeline data)

#### `GET /tasks`

- **Purpose**: Enhanced task endpoint with fallbacks
- **Response**: Rich pipeline data or standard data
- **Fallback**: Multiple fallback methods

### Parameters

- `location_id`: Your GoHighLevel location ID
- `pipeline_id`: Target pipeline ID
- `getTasks: true`: Key parameter for rich data
- `limit: 100`: Maximum opportunities to fetch
- `status: 'all'`: Include all opportunity statuses

## 🎉 Success Indicators

You'll know the integration is working when:

- ✅ Dashboard shows tasks grouped by user
- ✅ Each task displays opportunity context
- ✅ Data source information is visible
- ✅ Refresh button updates data
- ✅ Console shows rich pipeline logs
- ✅ Tasks include opportunity titles, stages, and values

## 🔗 Related Files

- **Server**: `ghl-oauth-server.js` (enhanced with new endpoints)
- **Dashboard**: `dashboard.html` (updated with refresh button)
- **Scripts**: `script.js` (enhanced data loading)
- **Styles**: `styles.css` (new opportunity context styles)
- **Test**: `test-dashboard.html` (isolated testing)
- **Integration Test**: `test-integration.js` (endpoint testing)

---

**🎯 Your standalone script is now fully integrated into your main server!**

The dashboard will automatically display rich pipeline data with opportunity context, and you can manually refresh it anytime. The integration maintains all the functionality of your standalone script while providing a seamless web interface.
