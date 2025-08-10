# Task Retrieval Quick Start Guide

## 🚀 **Get Started in 5 Minutes**

This guide will get you up and running with the task retrieval system that fetches tasks from your Client Software Development Pipeline opportunities.

---

## 📋 **Prerequisites**

- ✅ Node.js installed
- ✅ GoHighLevel account with `opportunities.readonly` scope
- ✅ OAuth server running (`ghl-oauth-server.js`)
- ✅ Valid authentication tokens

---

## 🔧 **Quick Setup**

### **1. Start the OAuth Server**

```bash
cd /path/to/your/project
node ghl-oauth-server.js
```

**Expected Output:**

```
🚀 GoHighLevel OAuth Server Starting...
✅ Server started on port 3000
🌐 OAuth flow available at: http://127.0.0.1:3000/oauth/init
```

### **2. Authenticate (if needed)**

If you haven't authenticated yet, visit:

```
http://127.0.0.1:3000/oauth/init
```

Follow the OAuth flow to grant permissions.

---

## 🎯 **Run Task Retrieval**

### **Basic Usage**

```bash
node get-tasks-standalone.js
```

### **Expected Output**

```
🚀 GoHighLevel Task Fetcher (Standalone)
🎯 Targeting tasks in: Client Software Development Pipeline
Connecting to running server...

1. Checking server health...
✅ Server is healthy

2. Checking authentication...
✅ Authenticated for location: QLyYYRoOhCg65lKW9HDX

3. Fetching tasks from target pipeline...
🎯 Target Pipeline: Client Software Development Pipeline (ID: uR2CMkTiwqoUOYuf8oGR)
🔍 Searching for opportunities with tasks in pipeline: uR2CMkTiwqoUOYuf8oGR
✅ Found 5 opportunities in pipeline
📋 Found 12 total tasks across opportunities
🎯 Opportunities with tasks: 5
✅ Pipeline tasks fetched successfully

📋 TASKS OVERVIEW
==================================================
🎯 Pipeline: Client Software Development Pipeline
🔧 Pipeline ID: uR2CMkTiwqoUOYuf8oGR
📍 Location ID: QLyYYRoOhCg65lKW9HDX
📊 Total Tasks: 12
🎯 Opportunities with Tasks: 5
🔍 Source: pipeline_opportunities_search

1. Create project proposal
   ID: task_123
   Status: pending
   Priority: high
   Due Date: 2024-01-15
   🎯 Opportunity: Website Redesign Project
   📊 Opportunity Status: open
   🏗️  Pipeline Stage: Proposal
   💰 Opportunity Value: $15000
```

---

## 🔍 **What You're Getting**

### **Pipeline-Focused Tasks**

- ✅ **Only tasks from your target pipeline**
- ✅ **Business context for each task**
- ✅ **Opportunity details (title, stage, value)**
- ✅ **Pipeline stage information**

### **Rich Task Information**

- Task title, status, priority, due date
- Associated opportunity details
- Pipeline stage and business value
- Contact information (if available)

---

## 🛠 **Troubleshooting**

### **Issue: "Server is not running"**

**Solution:**

```bash
# Start the OAuth server
node ghl-oauth-server.js
```

### **Issue: "Not authenticated"**

**Solution:**

```bash
# Visit the OAuth URL
http://127.0.0.1:3000/oauth/init
```

### **Issue: "No tasks found"**

**Possible Causes:**

- No opportunities in the target pipeline
- No tasks associated with opportunities
- Pipeline ID mismatch

**Solutions:**

1. Verify pipeline ID in GoHighLevel dashboard
2. Check if opportunities have tasks
3. Use fallback mode (automatic)

### **Issue: "No access token available"**

**Solution:**

```bash
# Check if tokens file exists
ls -la .tokens.json

# Re-authenticate if needed
http://127.0.0.1:1:3000/oauth/init
```

---

## 📊 **Understanding the Output**

### **Task Display Format**

```
1. [Task Title]
   ID: [task_id]
   Status: [pending/completed/overdue]
   Priority: [low/medium/high]
   Due Date: [YYYY-MM-DD]
   🎯 Opportunity: [Opportunity Name]
   📊 Opportunity Status: [open/won/lost]
   🏗️  Pipeline Stage: [Stage Name]
   💰 Opportunity Value: $[Amount]
```

### **Statistics Section**

- **Status Breakdown**: Tasks by status
- **Priority Breakdown**: Tasks by priority
- **Overdue Tasks**: Tasks past due date
- **Recent Tasks**: Latest task additions

---

## 🔄 **Fallback Behavior**

The system automatically falls back if pipeline search fails:

1. **Primary**: Pipeline-specific tasks (targeted)
2. **Secondary**: General task fetching (fallback)
3. **Tertiary**: File-based tokens (if server unavailable)

---

## 📁 **File Structure**

```
Project Daily Task Manager/
├── get-tasks-standalone.js          # Main task retrieval script
├── ghl-oauth-server.js             # OAuth authentication server
├── .tokens.json                    # Authentication tokens (auto-generated)
├── TASK_RETRIEVAL_DOCUMENTATION.md # Comprehensive documentation
└── TASK_RETRIEVAL_QUICK_START.md  # This quick start guide
```

---

## 🎯 **Customization**

### **Change Target Pipeline**

Edit `get-tasks-standalone.js`:

```javascript
const TARGET_PIPELINE = {
  name: "Your Pipeline Name",
  id: "your_pipeline_id",
};
```

### **Adjust Task Limits**

Modify the `limit` parameter in the API call:

```javascript
const params = {
  // ... other params
  limit: 200, // Increase from default 100
};
```

---

## 🚀 **Next Steps**

1. **Run the script** and verify output
2. **Review task context** and business relevance
3. **Customize pipeline targeting** if needed
4. **Explore advanced features** in the main documentation

---

## 📚 **Need More Help?**

- **Full Documentation**: `TASK_RETRIEVAL_DOCUMENTATION.md`
- **API Reference**: GoHighLevel API documentation
- **Error Codes**: Check the troubleshooting section above

---

## 🎉 **Success!**

You've successfully implemented a system that:

- ✅ **Retrieves tasks from specific pipeline opportunities**
- ✅ **Provides rich business context for each task**
- ✅ **Uses efficient API calls with smart fallbacks**
- ✅ **Delivers focused, revenue-relevant task information**

This achieves the core objective of your task manager: **getting business-relevant tasks with full context!**
