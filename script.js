// Global variables
let currentUser = null;
let tasks = [];
let contacts = [];
let currentFilter = 'all';
let currentSort = 'dueDate';
let editingTaskId = null;
let isLoading = false;

// Morning View Management
let currentView = 'morning';
let dailyGoals = JSON.parse(localStorage.getItem('dailyGoals') || '[]');
let morningRoutine = JSON.parse(localStorage.getItem('morningRoutine') || '[]');

// Initialize morning checklist with proper object structure
let morningChecklist = null;
try {
    const savedChecklist = localStorage.getItem('morningChecklist');
    if (savedChecklist) {
        morningChecklist = JSON.parse(savedChecklist);
    } else {
        morningChecklist = {
            date: new Date().toDateString(),
            routineCompleted: false,
            tasksReviewed: false,
            prioritiesSet: false,
            teamCheckin: false,
            startTime: null,
            endTime: null
        };
    }
} catch (error) {
    console.warn('Error parsing morning checklist, using default:', error);
    morningChecklist = {
        date: new Date().toDateString(),
        routineCompleted: false,
        tasksReviewed: false,
        prioritiesSet: false,
        teamCheckin: false,
        startTime: null,
        endTime: null
    };
}

// GoHighLevel API base URL
const GHL_API_BASE = 'http://localhost:3000';

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Morning Task Manager...');
    
    // Check if user is logged in
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    } else {
        // Set default user for demo purposes
        currentUser = { name: 'Admin User', id: 'admin-1' };
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    }
    
    // Set current date
    const today = new Date();
    document.getElementById('currentDate').textContent = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize morning view by default (only once)
    if (currentView === 'morning' && !window.morningViewInitialized) {
        window.morningViewInitialized = true;
        loadMorningViewData();
    }
    
    // Load daily goals and morning routine
    renderDailyGoals();
    renderMorningRoutine();
    
    // Show welcome message for morning view
    showMorningWelcome();
});

// Show morning welcome message
function showMorningWelcome() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = '';
    
    if (hour < 12) {
        greeting = 'Good morning! 🌅';
    } else if (hour < 17) {
        greeting = 'Good afternoon! ☀️';
    } else {
        greeting = 'Good evening! 🌙';
    }
    
    const welcomeMessage = `${greeting} Ready to tackle today's priorities?`;
    
    // Create a temporary welcome notification
    showNotification(welcomeMessage, 'info');
    
    // Update page subtitle with motivational message
    const subtitle = document.getElementById('currentDate');
    if (subtitle) {
        subtitle.innerHTML = `
            <span>${now.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}</span>
            <br>
            <small class="text-blue-600 font-medium">${welcomeMessage}</small>
        `;
    }
}

// Enhanced loading states
function showLoadingState(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loading-state text-center py-8">
                <div class="loading-spinner mb-4">🔄</div>
                <p class="text-gray-600">${message}</p>
            </div>
        `;
    }
}

function hideLoadingState(containerId) {
    const container = document.getElementById(containerId);
    if (container && container.querySelector('.loading-state')) {
        container.querySelector('.loading-state').remove();
    }
}

// Enhanced error handling
function handleError(error, context = '') {
    console.error(`❌ Error in ${context}:`, error);
    
    let userMessage = 'An error occurred. Please try again.';
    if (error.message) {
        userMessage = error.message;
    }
    
    showNotification(userMessage, 'error');
    
    // Log error for debugging
    if (window.console && console.error) {
        console.error(`Error context: ${context}`, error);
    }
}

// Load data from GoHighLevel with enhanced error handling
async function loadGHLData() {
    try {
        isLoading = true;
        showLoadingState('userTaskGroups', 'Loading your tasks and contacts...');
        
        // Load tasks and contacts simultaneously
        await Promise.all([
            loadGHLTasks(),
            loadGHLContacts()
        ]);
        
        // Update the display
        renderTasks();
        renderContacts();
        updateStatistics();
        
        hideLoadingState('userTaskGroups');
        
        // Show success message
        if (tasks.length > 0) {
            showNotification(`Successfully loaded ${tasks.length} tasks and ${contacts.length} contacts`, 'success');
        }
        
    } catch (error) {
        handleError(error, 'loading GHL data');
        hideLoadingState('userTaskGroups');
        
        // Show fallback content
        const container = document.getElementById('userTaskGroups');
        if (container) {
            container.innerHTML = `
                <div class="error-state text-center py-8">
                    <div class="error-icon mb-4">⚠️</div>
                    <h3 class="text-lg font-semibold text-red-600 mb-2">Unable to load data</h3>
                    <p class="text-gray-600 mb-4">There was an issue connecting to GoHighLevel.</p>
                    <button class="btn btn-primary" onclick="loadGHLData()">🔄 Retry</button>
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

// Load tasks from GoHighLevel
async function loadGHLTasks(forceRefresh = false) {
    // Prevent multiple simultaneous loads unless forced
    if (window.isLoadingTasks && !forceRefresh) {
        console.log('🔄 Tasks already loading, skipping duplicate request...');
        return;
    }
    
    try {
        window.isLoadingTasks = true;
        console.log('🎯 Loading rich pipeline tasks from GHL...');
        
        // First try the new rich pipeline endpoint
        let response = await fetch(`${GHL_API_BASE}/pipeline-tasks-rich`);
        let data = null;
        
        if (response.ok) {
            data = await response.json();
            console.log('✅ Rich pipeline tasks loaded:', data);
        } else {
            console.log('⚠️ Rich pipeline endpoint failed, falling back to standard tasks...');
            // Fallback to standard tasks endpoint
            response = await fetch(`${GHL_API_BASE}/tasks`);
            if (response.ok) {
                data = await response.json();
                console.log('📋 Standard tasks loaded:', data);
            } else {
                console.error('❌ Both endpoints failed');
                tasks = [];
                return;
            }
        }
        
        if (data && data.success) {
            // Convert GHL task format to our internal format
            // Handle both the new rich format from standalone script and legacy format
            const newTasks = data.tasks.map(task => {
                // Determine priority from various possible sources
                let priority = 'medium';
                if (task.priority) {
                    priority = task.priority.toLowerCase();
                } else if (task.opportunity_value && task.opportunity_value > 10000) {
                    priority = 'high'; // High-value opportunities get high priority
                }
                
                // Determine status from various possible sources
                let status = 'incomplete';
                if (task.completed) {
                    status = 'complete';
                } else if (task.status) {
                    status = task.status.toLowerCase();
                    // Map GHL statuses to our internal statuses
                    if (status.includes('in progress') || status.includes('working')) {
                        status = 'in-progress';
                    } else if (status.includes('complete') || status.includes('done')) {
                        status = 'complete';
                    }
                }
                
                // Determine owner/assignee
                let owner = 'Unassigned';
                if (task.assignedTo || task.assigned_to) {
                    owner = task.assignedTo || task.assigned_to;
                } else if (task.owner) {
                    owner = task.owner;
                }
                
                // Handle due date from various formats
                let dueDate = '';
                if (task.dueDate) {
                    dueDate = new Date(task.dueDate).toISOString().split('T')[0];
                    // Check if date is valid
                    if (isNaN(new Date(dueDate).getTime())) {
                        dueDate = '';
                    }
                } else if (task.due_date) {
                    dueDate = new Date(task.due_date).toISOString().split('T')[0];
                    // Check if date is valid
                    if (isNaN(new Date(dueDate).getTime())) {
                        dueDate = '';
                    }
                }
                
                // Handle creation date
                let createdAt = new Date().toISOString();
                if (task.createdAt) {
                    createdAt = new Date(task.createdAt).toISOString();
                } else if (task.dateCreated) {
                    createdAt = new Date(task.dateCreated).toISOString();
                } else if (task.date_created) {
                    createdAt = new Date(task.date_created).toISOString();
                }
                
                return {
                    id: task.id,
                    title: task.title || task.name || 'Untitled Task',
                    description: task.body || task.description || '',
                    dueDate: dueDate,
                    priority: priority,
                    status: status,
                    owner: owner,
                    createdAt: createdAt,
                    contactId: task.contactId || task.contact_id,
                    locationId: data.location_id || task.locationId,
                    // Additional opportunity context from standalone script
                    opportunityId: task.opportunity_id,
                    opportunityTitle: task.opportunity_title,
                    opportunityStatus: task.opportunity_status,
                    opportunityStage: task.opportunity_stage,
                    opportunityValue: task.opportunity_value,
                    pipelineId: task.pipeline_id || task.pipelineId,
                    // Additional task metadata
                    source: data.source || 'ghl_api',
                    method: data.method || 'standard_fetch'
                };
            });
            
            // Prevent duplicate tasks by checking both ID and content similarity
            const existingTaskIds = new Set(tasks.map(task => task.id));
            const existingTaskContent = new Set(tasks.map(task => 
                `${task.title}|${task.description}|${task.dueDate}|${task.owner}|${task.opportunityId}`
            ));
            
            const uniqueNewTasks = newTasks.filter(task => {
                // Check if ID already exists
                if (existingTaskIds.has(task.id)) {
                    return false;
                }
                
                // Check if content is similar (same title, description, due date, owner, and opportunity)
                const taskContent = `${task.title}|${task.description}|${task.dueDate}|${task.owner}|${task.opportunityId}`;
                if (existingTaskContent.has(taskContent)) {
                    console.log(`🔄 Skipping duplicate content task: ${task.title}`);
                    return false;
                }
                
                return true;
            });
            
            // Add only unique tasks to the existing array
            if (uniqueNewTasks.length > 0) {
                tasks.push(...uniqueNewTasks);
                console.log(`🆕 Added ${uniqueNewTasks.length} new unique tasks`);
            } else {
                console.log('ℹ️ No new unique tasks to add');
            }
            
            // Clean up any existing duplicates in the tasks array
            const cleanedTasks = removeDuplicateTasks(tasks);
            if (cleanedTasks.length < tasks.length) {
                const removedCount = tasks.length - cleanedTasks.length;
                tasks.length = 0; // Clear the array
                tasks.push(...cleanedTasks); // Add back the cleaned tasks
                console.log(`🧹 Removed ${removedCount} duplicate tasks from existing data`);
            }
            
            console.log(`🎉 Successfully loaded ${tasks.length} total tasks from GHL with rich context`);
            console.log(`📊 Data source: ${data.source || 'unknown'}`);
            console.log(`🔧 Method: ${data.method || 'unknown'}`);
            
            if (data.pipeline_name) {
                console.log(`🎯 Pipeline: ${data.pipeline_name}`);
            }
            if (data.opportunities_count) {
                console.log(`💼 Opportunities: ${data.opportunities_count}`);
            }
            
        } else {
            console.warn('❌ Failed to load tasks from GHL:', data);
            if (forceRefresh) {
                tasks = []; // Only clear tasks if this is a forced refresh
            }
        }
    } catch (error) {
        console.error('💥 Error loading GHL tasks:', error);
        if (forceRefresh) {
            tasks = []; // Only clear tasks if this is a forced refresh
        }
    } finally {
        window.isLoadingTasks = false;
    }
}

// Remove duplicate tasks based on content similarity
function removeDuplicateTasks(taskArray) {
    const seen = new Map();
    const uniqueTasks = [];
    
    taskArray.forEach(task => {
        // Create a content key based on title, description, due date, owner, and opportunity
        const contentKey = `${task.title}|${task.description}|${task.dueDate}|${task.owner}|${task.opportunityId}`;
        
        if (!seen.has(contentKey)) {
            seen.set(contentKey, true);
            uniqueTasks.push(task);
        } else {
            console.log(`🔄 Removing duplicate task: ${task.title}`);
        }
    });
    
    return uniqueTasks;
}

// Function to manually refresh pipeline tasks
async function refreshPipelineTasks() {
    try {
        console.log('🔄 Manually refreshing pipeline tasks...');
        showNotification('Refreshing pipeline tasks...', 'info');
        
        // Clear current tasks
        tasks = [];
        
        // Load fresh data with force refresh
        await loadGHLTasks(true);
        
        showNotification('Pipeline tasks refreshed successfully!', 'success');
    } catch (error) {
        console.error('Error refreshing pipeline tasks:', error);
        showNotification('Failed to refresh pipeline tasks', 'error');
    }
}

// Load contacts from GoHighLevel
async function loadGHLContacts() {
    try {
        const response = await fetch(`${GHL_API_BASE}/contacts`);
        const data = await response.json();
        
        if (data.success && data.contacts) {
            // Handle both array and object responses
            let contactsArray = data.contacts;
            if (!Array.isArray(contactsArray)) {
                // If contacts is an object, try to extract the array from it
                if (contactsArray.contacts && Array.isArray(contactsArray.contacts)) {
                    contactsArray = contactsArray.contacts;
                } else if (contactsArray.data && Array.isArray(contactsArray.data)) {
                    contactsArray = contactsArray.data;
                } else {
                    // If we can't find an array, log the structure and set empty array
                    console.warn('Contacts data structure unexpected:', data.contacts);
                    contacts = [];
                    return;
                }
            }
            
            contacts = contactsArray.map(contact => ({
                id: contact.id,
                name: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
                email: contact.email || '',
                phone: contact.phone || '',
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                locationId: contact.locationId
            }));
            console.log(`Successfully loaded ${contacts.length} contacts from GHL`);
        } else {
            console.warn('Failed to load contacts from GHL:', data);
            contacts = [];
        }
    } catch (error) {
        console.error('Error loading GHL contacts:', error);
        contacts = [];
    }
}

// Create a new task in GoHighLevel
async function createGHLTask(taskData) {
    try {
        const response = await fetch(`${GHL_API_BASE}/contacts/${taskData.contactId}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: taskData.title,
                body: taskData.description,
                dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Task created successfully in GoHighLevel', 'success');
            return data.task;
        } else {
            throw new Error(data.details || 'Failed to create task');
        }
    } catch (error) {
        console.error('Error creating GHL task:', error);
        showNotification('Error creating task in GoHighLevel', 'error');
        throw error;
    }
}

// Update a task in GoHighLevel
async function updateGHLTask(taskId, contactId, taskData) {
    try {
        const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: taskData.title,
                body: taskData.description,
                dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
                completed: taskData.status === 'complete'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Task updated successfully in GoHighLevel', 'success');
            return data.task;
        } else {
            throw new Error(data.details || 'Failed to update task');
        }
    } catch (error) {
        console.error('Error updating GHL task:', error);
        showNotification('Error updating task in GoHighLevel', 'error');
        throw error;
    }
}

// Delete a task from GoHighLevel
async function deleteGHLTask(taskId, contactId) {
    try {
        const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Task deleted successfully from GoHighLevel', 'success');
            return true;
        } else {
            throw new Error(data.details || 'Failed to delete task');
        }
    } catch (error) {
        console.error('Error deleting GHL task:', error);
        showNotification('Error deleting task from GoHighLevel', 'error');
        throw error;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize UI elements
function initializeUI() {
    // Set user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    
    // Set current date
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderTasks();
        });
    });
    
    // Sort dropdown
    document.getElementById('sortBy').addEventListener('change', function() {
        currentSort = this.value;
        renderTasks();
    });
    
    // Modal close on backdrop click
    document.getElementById('taskModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

// Task management functions
function renderTasks() {
    const userTaskGroupsContainer = document.getElementById('userTaskGroups');
    const legacyContainer = document.getElementById('taskContainer');
    const dataSourceInfoContainer = document.getElementById('dataSourceInfo');
    
    let filteredTasks = filterTasks();
    filteredTasks = sortTasks(filteredTasks);
    
    if (filteredTasks.length === 0) {
        userTaskGroupsContainer.innerHTML = '<div class="p-6 text-center text-gray-500">No tasks found</div>';
        legacyContainer.style.display = 'none';
        dataSourceInfoContainer.style.display = 'none';
        return;
    }
    
    // Show data source info if available
    if (filteredTasks.length > 0 && filteredTasks[0].source) {
        const uniqueSources = [...new Set(filteredTasks.map(task => task.source))];
        const uniqueMethods = [...new Set(filteredTasks.map(task => task.method))];
        const pipelineIds = [...new Set(filteredTasks.map(task => task.pipelineId).filter(Boolean))];
        
        dataSourceInfoContainer.innerHTML = `
            <h4>📊 Data Source Information</h4>
            <div class="data-source-details">
                ${uniqueSources.length > 0 ? `<div class="data-source-item">
                    <span class="data-source-label">Source:</span>
                    <span class="data-source-value">${uniqueSources.join(', ')}</span>
                </div>` : ''}
                ${uniqueMethods.length > 0 ? `<div class="data-source-item">
                    <span class="data-source-label">Method:</span>
                    <span class="data-source-value">${uniqueMethods.join(', ')}</span>
                </div>` : ''}
                ${pipelineIds.length > 0 ? `<div class="data-source-item">
                    <span class="data-source-label">Pipeline:</span>
                    <span class="data-source-value">${pipelineIds.join(', ')}</span>
                </div>` : ''}
                <div class="data-source-item">
                    <span class="data-source-label">Total Tasks:</span>
                    <span class="data-source-value">${filteredTasks.length}</span>
                </div>
            </div>
        `;
        dataSourceInfoContainer.style.display = 'block';
    } else {
        dataSourceInfoContainer.style.display = 'none';
    }
    
    // Group tasks by assigned user
    const tasksByUser = groupTasksByUser(filteredTasks);
    
    // Render tasks grouped by user
    userTaskGroupsContainer.innerHTML = renderUserTaskGroups(tasksByUser);
    
    // Hide legacy container
    legacyContainer.style.display = 'none';
}

function groupTasksByUser(tasks) {
    const grouped = {};
    
    tasks.forEach(task => {
        const owner = task.owner || 'Unassigned';
        if (!grouped[owner]) {
            grouped[owner] = [];
        }
        grouped[owner].push(task);
    });
    
    return grouped;
}

function renderUserTaskGroups(tasksByUser) {
    let html = '';
    
    Object.keys(tasksByUser).forEach(userName => {
        const userTasks = tasksByUser[userName];
        const completedCount = userTasks.filter(task => task.status === 'complete').length;
        const totalCount = userTasks.length;
        
        html += `
            <div class="user-task-group mb-6">
                <div class="user-task-header">
                    <h3 class="user-name">👤 ${userName}</h3>
                    <div class="user-task-stats">
                        <span class="task-count">${completedCount}/${totalCount} completed</span>
                    </div>
                </div>
                <div class="user-tasks">
                    ${userTasks.length > 0 ? userTasks.map(task => createTaskHTML(task)).join('') : '<div class="p-4 text-center text-gray-500">No tasks assigned</div>'}
                </div>
            </div>
        `;
    });
    
    return html;
}

function filterTasks() {
    const searchTerm = document.getElementById('taskSearch').value.toLowerCase();
    const priorityFilter = document.getElementById('priorityFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const ownerFilter = document.getElementById('ownerFilter').value;
    const dueDateFilter = document.getElementById('dueDateFilter').value;
    
    const filteredTasks = tasks.filter(task => {
        // Search filter
        const matchesSearch = !searchTerm || 
            task.title.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm));
        
        // Priority filter
        const matchesPriority = !priorityFilter || task.priority === priorityFilter;
        
        // Status filter
        const matchesStatus = !statusFilter || task.status === statusFilter;
        
        // Owner filter
        const matchesOwner = !ownerFilter || task.owner === ownerFilter;
        
        // Due date filter
        let matchesDueDate = true;
        if (dueDateFilter) {
            const today = new Date();
            const taskDate = new Date(task.dueDate);
            
            switch (dueDateFilter) {
                case 'today':
                    matchesDueDate = taskDate.toDateString() === today.toDateString();
                    break;
                case 'tomorrow':
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    matchesDueDate = taskDate.toDateString() === tomorrow.toDateString();
                    break;
                case 'this-week':
                    const endOfWeek = new Date(today);
                    endOfWeek.setDate(today.getDate() + 7);
                    matchesDueDate = taskDate >= today && taskDate <= endOfWeek;
                    break;
                case 'overdue':
                    matchesDueDate = taskDate < today && task.status !== 'complete';
                    break;
            }
        }
        
        return matchesSearch && matchesPriority && matchesStatus && matchesOwner && matchesDueDate;
    });
    
    renderFilteredTasks(filteredTasks);
}

function renderFilteredTasks(filteredTasks) {
    const taskList = document.querySelector('#allTasksView .task-list');
    const taskHeader = taskList.querySelector('.task-header');
    
    // Update task count
    const taskCount = taskHeader.querySelector('p');
    taskCount.textContent = `Showing ${filteredTasks.length} of ${tasks.length} tasks`;
    
    // Clear existing tasks
    const existingTasks = taskList.querySelectorAll('.task-item:not(.task-header)');
    existingTasks.forEach(task => task.remove());
    
    // Render filtered tasks
    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });
    
    if (filteredTasks.length === 0) {
        const noTasksElement = document.createElement('div');
        noTasksElement.className = 'text-center py-8 text-gray-500';
        noTasksElement.innerHTML = `
            <div class="text-4xl mb-2">📝</div>
            <p>No tasks match your current filters</p>
            <button class="btn btn-primary mt-2" onclick="clearFilters()">Clear Filters</button>
        `;
        taskList.appendChild(noTasksElement);
    }
}

function clearFilters() {
    document.getElementById('taskSearch').value = '';
    document.getElementById('priorityFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('ownerFilter').value = '';
    document.getElementById('dueDateFilter').value = '';
    
    // Re-render all tasks
    const taskList = document.querySelector('#allTasksView .task-list');
    const taskHeader = taskList.querySelector('.task-header');
    
    // Update task count
    const taskCount = taskHeader.querySelector('p');
    taskCount.textContent = `Showing ${tasks.length} tasks`;
    
    // Clear existing tasks
    const existingTasks = taskList.querySelectorAll('.task-item:not(.task-header)');
    existingTasks.forEach(task => task.remove());
    
    // Render all tasks
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });
}

function exportFilteredTasks() {
    const searchTerm = document.getElementById('taskSearch').value.toLowerCase();
    const priorityFilter = document.getElementById('priorityFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const ownerFilter = document.getElementById('ownerFilter').value;
    const dueDateFilter = document.getElementById('dueDateFilter').value;
    
    // Apply same filtering logic
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = !searchTerm || 
            task.title.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm));
        const matchesPriority = !priorityFilter || task.priority === priorityFilter;
        const matchesStatus = !statusFilter || task.status === statusFilter;
        const matchesOwner = !ownerFilter || task.owner === ownerFilter;
        
        let matchesDueDate = true;
        if (dueDateFilter) {
            const today = new Date();
            const taskDate = new Date(task.dueDate);
            
            switch (dueDateFilter) {
                case 'today':
                    matchesDueDate = taskDate.toDateString() === today.toDateString();
                    break;
                case 'tomorrow':
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    matchesDueDate = taskDate.toDateString() === tomorrow.toDateString();
                    break;
                case 'this-week':
                    const endOfWeek = new Date(today);
                    endOfWeek.setDate(today.getDate() + 7);
                    matchesDueDate = taskDate >= today && taskDate <= endOfWeek;
                    break;
                case 'overdue':
                    matchesDueDate = taskDate < today && task.status !== 'complete';
                    break;
            }
        }
        
        return matchesSearch && matchesPriority && matchesStatus && matchesOwner && matchesDueDate;
    });
    
    if (filteredTasks.length === 0) {
        showToast('No tasks to export with current filters', 'warning');
        return;
    }
    
    // Export filtered tasks
    const dataStr = JSON.stringify(filteredTasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtered-tasks-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${filteredTasks.length} tasks successfully`, 'success');
}

function sortTasks(tasks) {
    return tasks.sort((a, b) => {
        switch (currentSort) {
            case 'priority':
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            case 'status':
                const statusOrder = { 'incomplete': 3, 'in-progress': 2, 'complete': 1 };
                return statusOrder[b.status] - statusOrder[a.status];
            case 'title':
                return a.title.localeCompare(b.title);
            default: // dueDate
                return new Date(a.dueDate) - new Date(b.dueDate);
        }
    });
}

function createTaskHTML(task) {
    const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'complete';
    const priorityClass = `priority-${task.priority}`;
    const statusClass = `status-${task.status}`;
    
    // Find contact information
    const contact = contacts.find(c => c.id === task.contactId);
    const contactName = contact ? contact.name || contact.email || contact.phone : 'Unknown Contact';
    
    // Build opportunity context HTML if available
    let opportunityContext = '';
    if (task.opportunityTitle || task.opportunityStage || task.opportunityValue) {
        opportunityContext = `
            <div class="opportunity-context">
                <div class="opportunity-header">
                    <span class="opportunity-icon">🎯</span>
                    <span class="opportunity-title">${task.opportunityTitle || 'Untitled Opportunity'}</span>
                </div>
                <div class="opportunity-details">
                    ${task.opportunityStage ? `<span class="stage-badge">${task.opportunityStage}</span>` : ''}
                    ${task.opportunityValue ? `<span class="value-badge">$${task.opportunityValue.toLocaleString()}</span>` : ''}
                    ${task.opportunityStatus ? `<span class="status-badge">${task.opportunityStatus}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="task-item ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
            <input type="checkbox" class="task-checkbox" ${task.status === 'complete' ? 'checked' : ''} 
                   onchange="toggleTaskStatus('${task.id}')">
            
            <div class="task-content">
                <div class="task-title">${task.title}</div>
                <div class="task-description">${task.description || 'No description'}</div>
                
                ${opportunityContext}
                
                <div class="task-meta">
                    <span>📞 Contact: ${contactName}</span>
                    <span>📅 Due: ${formatDate(task.dueDate)}</span>
                    <span>👤 Owner: ${task.owner}</span>
                    <span class="priority-badge ${priorityClass}">${task.priority.toUpperCase()}</span>
                    <span class="status-badge ${statusClass}">${task.status.replace('-', ' ').toUpperCase()}</span>
                </div>
            </div>
            
            <div class="task-actions">
                <button class="btn btn-secondary btn-sm" onclick="editTask('${task.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="deleteTask('${task.id}')">Delete</button>
            </div>
        </div>
    `;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function toggleTaskStatus(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        const newStatus = task.status === 'complete' ? 'incomplete' : 'complete';
        
        try {
            // Update task in GHL
            await updateGHLTask(taskId, task.contactId, {
                ...task,
                status: newStatus
            });
            
            // Update local task
            task.status = newStatus;
            renderTasks();
            updateStatistics();
            
        } catch (error) {
            console.error('Error updating task status:', error);
            showNotification('Error updating task status', 'error');
        }
    }
}

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        editingTaskId = taskId;
        
        // Populate modal with task data
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskDueDate').value = task.dueDate;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskOwner').value = task.owner;
        
        document.querySelector('.modal-title').textContent = 'Edit Task';
        document.getElementById('taskModal').classList.remove('hidden');
    }
}

async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            try {
                // Delete task from GHL
                await deleteGHLTask(taskId, task.contactId);
                
                // Remove from local tasks
                tasks = tasks.filter(t => t.id !== taskId);
                renderTasks();
                updateStatistics();
                
            } catch (error) {
                console.error('Error deleting task:', error);
                showNotification('Error deleting task', 'error');
            }
        }
    }
}

function addNewTask() {
    editingTaskId = null;
    
    // Clear modal form
    document.getElementById('taskForm').reset();
    document.getElementById('taskOwner').value = currentUser.name;
    
    // Populate contact dropdown
    populateContactDropdown();
    
    document.querySelector('.modal-title').textContent = 'Add New Task';
    document.getElementById('taskModal').classList.remove('hidden');
}

// Populate contact dropdown in task modal
function populateContactDropdown() {
    const contactSelect = document.getElementById('taskContactId');
    contactSelect.innerHTML = '<option value="">Select a contact...</option>';
    
    contacts.forEach(contact => {
        const option = document.createElement('option');
        option.value = contact.id;
        option.textContent = contact.name || contact.email || contact.phone;
        contactSelect.appendChild(option);
    });
}

// Render contacts section
function renderContacts() {
    const container = document.getElementById('contactsContainer');
    
    if (contacts.length === 0) {
        container.innerHTML = '<div class="col-span-3 text-center text-gray-500 py-8">No contacts found</div>';
        return;
    }
    
    container.innerHTML = contacts.slice(0, 6).map(contact => createContactHTML(contact)).join('');
}

// Create HTML for a contact card
function createContactHTML(contact) {
    const name = contact.name || `${contact.firstName} ${contact.lastName}`.trim() || 'Unknown';
    const email = contact.email || 'No email';
    const phone = contact.phone || 'No phone';
    
    return `
        <div class="contact-card bg-gray-50 p-3 rounded-lg border">
            <div class="flex items-center mb-2">
                <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    ${name.charAt(0).toUpperCase()}
                </div>
                <div class="ml-3">
                    <div class="font-medium text-gray-900">${name}</div>
                    <div class="text-sm text-gray-500">${email}</div>
                </div>
            </div>
            <div class="text-sm text-gray-600">
                <div>📞 ${phone}</div>
            </div>
            <div class="mt-2 flex justify-end">
                <button class="btn btn-primary btn-sm" onclick="createTaskForContact('${contact.id}')">
                    + Add Task
                </button>
            </div>
        </div>
    `;
}

// Create task for specific contact
function createTaskForContact(contactId) {
    editingTaskId = null;
    
    // Clear modal form
    document.getElementById('taskForm').reset();
    document.getElementById('taskOwner').value = currentUser.name;
    
    // Populate contact dropdown and select the specific contact
    populateContactDropdown();
    document.getElementById('taskContactId').value = contactId;
    
    document.querySelector('.modal-title').textContent = 'Add New Task';
    document.getElementById('taskModal').classList.remove('hidden');
}

async function saveTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const dueDate = document.getElementById('taskDueDate').value;
    const priority = document.getElementById('taskPriority').value;
    const status = document.getElementById('taskStatus').value;
    const owner = document.getElementById('taskOwner').value;
    const contactId = document.getElementById('taskContactId').value;
    
    if (!title || !dueDate) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (!contactId && !editingTaskId) {
        alert('Please select a contact for the task');
        return;
    }
    
    const taskData = {
        title,
        description,
        dueDate,
        priority,
        status,
        owner,
        contactId
    };
    
    try {
        if (editingTaskId) {
            // Update existing task in GHL
            const existingTask = tasks.find(t => t.id === editingTaskId);
            if (existingTask) {
                const updatedTask = await updateGHLTask(editingTaskId, existingTask.contactId, taskData);
                
                // Update local task array
                const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex] = {
                        ...tasks[taskIndex],
                        ...taskData,
                        id: updatedTask.id,
                        status: updatedTask.completed ? 'complete' : 'incomplete'
                    };
                }
            }
        } else {
            // Create new task in GHL
            const newTask = await createGHLTask(taskData);
            
            // Add to local task array
            tasks.push({
                id: newTask.id,
                title: newTask.title,
                description: newTask.body || '',
                dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString().split('T')[0] : '',
                priority: taskData.priority,
                status: newTask.completed ? 'complete' : 'incomplete',
                owner: taskData.owner,
                contactId: newTask.contactId,
                createdAt: new Date().toISOString()
            });
        }

        renderTasks();
        updateStatistics();
        closeModal();
        
    } catch (error) {
        console.error('Error saving task:', error);
        alert('Error saving task: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('taskModal').classList.add('hidden');
    editingTaskId = null;
}

function updateStatistics() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'complete').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const overdue = tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'complete').length;
    
    // Only update statistics if we're in the all tasks view and elements exist
    const totalTasksElement = document.getElementById('totalTasks');
    const completedTasksElement = document.getElementById('completedTasks');
    const inProgressTasksElement = document.getElementById('inProgressTasks');
    const overdueTasksElement = document.getElementById('overdueTasks');
    
    if (totalTasksElement) totalTasksElement.textContent = total;
    if (completedTasksElement) completedTasksElement.textContent = completed;
    if (inProgressTasksElement) inProgressTasksElement.textContent = inProgress;
    if (overdueTasksElement) overdueTasksElement.textContent = overdue;
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Navigation functions
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // ESC to close modal
    if (e.key === 'Escape' && !document.getElementById('taskModal').classList.contains('hidden')) {
        closeModal();
    }
    
    // Ctrl+N to add new task
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        addNewTask();
    }
});

// Add touch support for mobile
if ('ontouchstart' in window) {
    document.addEventListener('touchstart', function() {}, { passive: true });
}

// Auto-refresh every 30 seconds (only when in all tasks view)
setInterval(function() {
    // Only update statistics if we're in the all tasks view
    if (currentView === 'all' && document.getElementById('totalTasks')) {
        updateStatistics();
    }
}, 30000); 

// Morning View Management
function switchToMorningView() {
    currentView = 'morning';
    document.getElementById('morningView').style.display = 'block';
    document.getElementById('allTasksView').style.display = 'none';
    document.getElementById('pageTitle').textContent = 'Morning Task Review';
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-filter="morning"]').classList.add('active');
    
    // Load morning view data
    loadMorningViewData();
}

function switchToAllTasksView() {
    currentView = 'all';
    document.getElementById('morningView').style.display = 'none';
    document.getElementById('allTasksView').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Daily Tasks';
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-filter="all"]').classList.add('active');
    
    // Render tasks in the original format
    renderTasks();
}

function switchToMyTasksView() {
    currentView = 'my';
    document.getElementById('morningView').style.display = 'none';
    document.getElementById('allTasksView').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'My Tasks';
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-filter="my"]').classList.add('active');
    
    // Filter to show only current user's tasks
    const myTasks = tasks.filter(task => task.owner === 'Admin User'); // Replace with actual user detection
    renderFilteredTasks(myTasks);
}

function switchToTeamView() {
    currentView = 'team';
    document.getElementById('morningView').style.display = 'none';
    document.getElementById('allTasksView').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Team Overview';
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-filter="team"]').classList.add('active');
    
    // Show team-focused view
    renderTeamView();
}

function switchToOverdueView() {
    currentView = 'overdue';
    document.getElementById('morningView').style.display = 'none';
    document.getElementById('allTasksView').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Overdue Tasks';
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-filter="overdue"]').classList.add('active');
    
    // Filter to show only overdue tasks
    const overdueTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate < today && task.status !== 'complete';
    });
    renderFilteredTasks(overdueTasks);
}

// Morning View Data Loading
async function loadMorningViewData() {
    // Prevent multiple simultaneous loads
    if (window.isLoadingMorningView) {
        console.log('🔄 Morning view already loading, skipping duplicate request...');
        return;
    }
    
    try {
        window.isLoadingMorningView = true;
        console.log('🌅 Loading morning view data...');
        
        // Reset checklist for new day
        resetMorningChecklist();
        
        // Show loading state for morning view
        showLoadingState('priorityTasks', 'Loading today\'s priorities...');
        showLoadingState('teamOverview', 'Loading team status...');
        
        // Load tasks if not already loaded (no need to force refresh)
        if (tasks.length === 0) {
            await loadGHLTasks(false);
        } else {
            // Clean up any existing duplicates in the current tasks array
            const cleanedTasks = removeDuplicateTasks(tasks);
            if (cleanedTasks.length < tasks.length) {
                const removedCount = tasks.length - cleanedTasks.length;
                tasks.length = 0; // Clear the array
                tasks.push(...cleanedTasks); // Add back the cleaned tasks
                console.log(`🧹 Cleaned up ${removedCount} duplicate tasks from existing data`);
            }
        }
        
        // Update summary cards
        updateSummaryCards();
        
        // Render priority tasks with enhanced categorization
        renderPriorityTasks();
        
        // Render team overview
        renderTeamOverview();
        
        // Load daily goals and morning routine
        renderDailyGoals();
        renderMorningRoutine();
        
        // Hide loading states
        hideLoadingState('priorityTasks');
        hideLoadingState('teamOverview');
        
        // Mark tasks as reviewed
        updateMorningChecklist('tasksReviewed');
        
        console.log('✅ Morning view data loaded successfully');
        
    } catch (error) {
        handleError(error, 'loading morning view data');
        hideLoadingState('priorityTasks');
        hideLoadingState('teamOverview');
    } finally {
        window.isLoadingMorningView = false;
    }
}

// Update Summary Cards
function updateSummaryCards() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate today's priorities (high priority + due today)
    const todayPriorities = tasks.filter(task => {
        if (task.status === 'complete') return false;
        if (task.priority === 'high') return true;
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime();
        }
        return false;
    }).length;
    
    // Calculate urgent items (overdue + high priority)
    const urgentItems = tasks.filter(task => {
        if (task.status === 'complete') return false;
        if (task.priority === 'high') return true;
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < today;
        }
        return false;
    }).length;
    
    // Calculate team active members
    const teamMembers = new Set(tasks.map(task => task.owner).filter(owner => owner && owner !== 'Unassigned'));
    const teamActive = teamMembers.size;
    
    // Calculate weekly progress
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weeklyTasks = tasks.filter(task => {
        if (!task.createdAt) return false;
        const createdDate = new Date(task.createdAt);
        return createdDate >= weekStart && createdDate <= weekEnd;
    });
    
    const completedThisWeek = weeklyTasks.filter(task => task.status === 'complete').length;
    const weeklyProgress = weeklyTasks.length > 0 ? Math.round((completedThisWeek / weeklyTasks.length) * 100) : 0;
    
    // Update DOM
    document.getElementById('todayPriorities').textContent = todayPriorities;
    document.getElementById('urgentItems').textContent = urgentItems;
    document.getElementById('teamActive').textContent = teamActive;
    document.getElementById('weeklyProgress').textContent = weeklyProgress + '%';
}

// Enhanced Priority Task Rendering with Smart Categorization
function renderPriorityTasks() {
    const priorityTasksContainer = document.getElementById('priorityTasks');
    if (!priorityTasksContainer) return;
    
    // Clear the container first to prevent duplicate rendering
    priorityTasksContainer.innerHTML = '';
    
    // Categorize tasks by priority and urgency
    const taskCategories = categorizeTasksByPriority();
    
    if (Object.keys(taskCategories).length === 0) {
        priorityTasksContainer.innerHTML = `
            <div class="priority-task-card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <p class="text-gray-500">🎉 No priority tasks for today! Great job staying on top of things.</p>
            </div>
        `;
        return;
    }
    
    let priorityTasksHTML = '';
    
    // Render each category
    Object.entries(taskCategories).forEach(([category, tasks]) => {
        if (tasks.length === 0) return;
        
        priorityTasksHTML += `
            <div class="priority-category-header" style="grid-column: 1 / -1; margin: 1rem 0;">
                <h4 class="text-lg font-semibold text-gray-800">${getCategoryDisplayName(category)}</h4>
                <p class="text-sm text-gray-600">${tasks.length} task${tasks.length > 1 ? 's' : ''}</p>
            </div>
        `;
        
        // Render tasks in this category
        tasks.forEach(task => {
            priorityTasksHTML += createEnhancedPriorityTaskHTML(task, category);
        });
    });
    
    priorityTasksContainer.innerHTML = priorityTasksHTML;
    
    // Mark priorities as set
    updateMorningChecklist('prioritiesSet');
}

// Smart task categorization
function categorizeTasksByPriority() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const categories = {
        critical: [],      // Overdue + High Priority
        urgent: [],        // Due today + High Priority
        important: [],     // Due this week + Medium Priority
        routine: []        // Other active tasks
    };
    
    tasks.forEach(task => {
        if (task.status === 'complete') return;
        
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = dueDate && dueDate < today;
        const isDueToday = dueDate && dueDate.getTime() === today.getTime();
        const isDueThisWeek = dueDate && dueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        if (isOverdue && task.priority === 'high') {
            categories.critical.push(task);
        } else if (isDueToday && task.priority === 'high') {
            categories.urgent.push(task);
        } else if (isDueThisWeek && task.priority === 'medium') {
            categories.important.push(task);
        } else if (task.priority === 'high' || task.priority === 'medium') {
            categories.routine.push(task);
        }
    });
    
    // Sort tasks within each category
    Object.keys(categories).forEach(category => {
        categories[category].sort((a, b) => {
            // Sort by priority first, then by due date
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            
            if (priorityDiff !== 0) return priorityDiff;
            
            // Then by due date (earlier first)
            if (a.dueDate && b.dueDate) {
                return new Date(a.dueDate) - new Date(b.dueDate);
            }
            
            return 0;
        });
    });
    
    return categories;
}

// Get display name for task categories
function getCategoryDisplayName(category) {
    const names = {
        critical: '🚨 Critical (Overdue + High Priority)',
        urgent: '🔥 Urgent (Due Today + High Priority)',
        important: '⭐ Important (This Week + Medium Priority)',
        routine: '📋 Routine (Active Tasks)'
    };
    return names[category] || category;
}

// Create enhanced priority task HTML
function createEnhancedPriorityTaskHTML(task, category) {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
    const priorityClass = getPriorityClass(task.priority, isOverdue);
    const categoryClass = getCategoryClass(category);
    
    const dueDateText = task.dueDate ? formatDate(task.dueDate) : 'No due date';
    const dueDateClass = isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600';
    
    // Get contact information
    const contact = contacts.find(c => c.id === task.contactId);
    const contactName = contact ? contact.name || contact.email || contact.phone : 'Unknown Contact';
    
    // Build opportunity context HTML if available
    let opportunityContext = '';
    if (task.opportunityTitle || task.opportunityStage || task.opportunityValue) {
        opportunityContext = `
            <div class="opportunity-context mt-2 p-2 bg-blue-50 rounded text-sm">
                <div class="flex items-center gap-2">
                    <span class="opportunity-icon">🎯</span>
                    <span class="opportunity-title font-medium">${task.opportunityTitle || 'Untitled Opportunity'}</span>
                </div>
                <div class="opportunity-details flex gap-2 mt-1">
                    ${task.opportunityStage ? `<span class="stage-badge px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs">${task.opportunityStage}</span>` : ''}
                    ${task.opportunityValue ? `<span class="value-badge px-2 py-1 bg-green-200 text-green-800 rounded text-xs">$${task.opportunityValue.toLocaleString()}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="priority-task-card ${priorityClass} ${categoryClass}">
            <div class="priority-task-header">
                <div class="flex items-start justify-between">
                    <h3 class="priority-task-title">${task.title}</h3>
                    <div class="priority-task-meta flex gap-2">
                        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                        <span class="status-badge status-${task.status}">${task.status}</span>
                    </div>
                </div>
            </div>
            
            ${task.description ? `<p class="priority-task-description">${task.description}</p>` : ''}
            
            ${opportunityContext}
            
            <div class="priority-task-footer">
                <div class="flex items-center gap-4 text-sm">
                    <span class="priority-task-owner">👤 ${task.owner}</span>
                    <span class="priority-task-contact">📞 ${contactName}</span>
                    <span class="priority-task-due ${dueDateClass}">📅 ${dueDateText}</span>
                </div>
                
                <div class="priority-task-actions mt-3 flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="toggleTaskStatus('${task.id}')">
                        ${task.status === 'complete' ? '✅ Completed' : '☐ Mark Complete'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="editTask('${task.id}')">✏️ Edit</button>
                </div>
            </div>
        </div>
    `;
}

// Get priority class for styling
function getPriorityClass(priority, isOverdue) {
    if (isOverdue) return 'overdue';
    switch (priority) {
        case 'high': return 'high-priority';
        case 'medium': return 'medium-priority';
        case 'low': return 'low-priority';
        default: return 'medium-priority';
    }
}

// Get category class for styling
function getCategoryClass(category) {
    switch (category) {
        case 'critical': return 'category-critical';
        case 'urgent': return 'category-urgent';
        case 'important': return 'category-important';
        case 'routine': return 'category-routine';
        default: return '';
    }
}

// Morning Routine Management
function addMorningRoutineItem() {
    const routineInput = document.getElementById('routineInput');
    const routineText = routineInput.value.trim();
    
    if (!routineText) return;
    
    const newRoutineItem = {
        id: Date.now(),
        text: routineText,
        completed: false,
        createdAt: new Date().toISOString(),
        order: morningRoutine.length
    };
    
    morningRoutine.push(newRoutineItem);
    saveMorningRoutine();
    renderMorningRoutine();
    
    routineInput.value = '';
    showNotification('Morning routine item added!', 'success');
}

function toggleMorningRoutineItem(itemId) {
    const item = morningRoutine.find(r => r.id === itemId);
    if (item) {
        item.completed = !item.completed;
        saveMorningRoutine();
        renderMorningRoutine();
        
        // Show completion message
        if (item.completed) {
            showNotification(`✅ Completed: ${item.text}`, 'success');
        }
        
        // Check if all routine items are completed
        checkMorningRoutineCompletion();
        
        // Update morning checklist
        if (morningRoutine.every(r => r.completed)) {
            updateMorningChecklist('routineCompleted');
        }
    }
}

function deleteMorningRoutineItem(itemId) {
    morningRoutine = morningRoutine.filter(r => r.id !== itemId);
    saveMorningRoutine();
    renderMorningRoutine();
    showNotification('Routine item removed', 'info');
}

function saveMorningRoutine() {
    localStorage.setItem('morningRoutine', JSON.stringify(morningRoutine));
}

function renderMorningRoutine() {
    const routineContainer = document.getElementById('morningRoutine');
    if (!routineContainer) return;
    
    if (morningRoutine.length === 0) {
        routineContainer.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <p>No morning routine set. Add your first routine item above!</p>
            </div>
        `;
        return;
    }
    
    const routineHTML = morningRoutine.map(item => `
        <div class="morning-routine-item">
            <input type="checkbox" 
                   class="morning-routine-checkbox" 
                   ${item.completed ? 'checked' : ''} 
                   onchange="toggleMorningRoutineItem(${item.id})">
            <span class="morning-routine-text ${item.completed ? 'morning-routine-completed' : ''}">
                ${item.text}
            </span>
            <button class="morning-routine-delete" onclick="deleteMorningRoutineItem(${item.id})" title="Remove routine item">
                🗑️
            </button>
        </div>
    `).join('');
    
    routineContainer.innerHTML = routineHTML;
}

// Check morning routine completion
function checkMorningRoutineCompletion() {
    if (morningRoutine.length === 0) return;
    
    const completedCount = morningRoutine.filter(item => item.completed).length;
    const totalCount = morningRoutine.length;
    
    if (completedCount === totalCount) {
        showNotification('🎉 Morning routine completed! Great start to your day!', 'success');
        
        // Show productivity boost message
        setTimeout(() => {
            showProductivityInsights();
        }, 2000);
    } else if (completedCount >= totalCount * 0.8) {
        showNotification('🚀 Almost done with your morning routine!', 'info');
    }
}

// Show productivity insights
function showProductivityInsights() {
    const insightsModal = document.createElement('div');
    insightsModal.className = 'modal';
    insightsModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2 class="modal-title">📊 Productivity Insights</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="productivity-insights">
                    <h3>🎯 Today's Focus Areas</h3>
                    <div class="insights-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 1rem 0;">
                        <div class="insight-item">
                            <strong>High Priority Tasks:</strong> ${tasks.filter(t => t.priority === 'high' && t.status !== 'complete').length}
                        </div>
                        <div class="insight-item">
                            <strong>Due Today:</strong> ${tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length}
                        </div>
                        <div class="insight-item">
                            <strong>Team Collaboration:</strong> ${countCollaborativeTasks()}
                        </div>
                        <div class="insight-item">
                            <strong>Weekly Progress:</strong> ${calculateWeeklyProgress()}%
                        </div>
                    </div>
                    
                    <h3>💡 Morning Recommendations</h3>
                    <ul>
                        ${generateMorningRecommendations()}
                    </ul>
                    
                    <h3>🎉 Achievement Unlocked</h3>
                    <p>You've completed your morning routine! This sets you up for a productive day.</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(insightsModal);
    setTimeout(() => insightsModal.classList.add('show'), 10);
}

// Generate morning recommendations based on current data
function generateMorningRecommendations() {
    const recommendations = [];
    
    // Check for overdue tasks
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'complete');
    if (overdueTasks.length > 0) {
        recommendations.push(`<li>⚠️ Address ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} first</li>`);
    }
    
    // Check for high priority tasks
    const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'complete');
    if (highPriorityTasks.length > 0) {
        recommendations.push(`<li>🔥 Focus on ${highPriorityTasks.length} high-priority task${highPriorityTasks.length > 1 ? 's' : ''}</li>`);
    }
    
    // Check for team collaboration opportunities
    const teamTasks = tasks.filter(t => t.owner !== currentUser.name && t.status !== 'complete');
    if (teamTasks.length > 0) {
        recommendations.push(`<li>👥 Check in with team members on ${teamTasks.length} collaborative task${teamTasks.length > 1 ? 's' : ''}</li>`);
    }
    
    // Check for upcoming deadlines
    const upcomingDeadlines = tasks.filter(t => {
        if (!t.dueDate || t.status === 'complete') return false;
        const dueDate = new Date(t.dueDate);
        const today = new Date();
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 3 && diffDays > 0;
    });
    
    if (upcomingDeadlines.length > 0) {
        recommendations.push(`<li>📅 ${upcomingDeadlines.length} task${upcomingDeadlines.length > 1 ? 's' : ''} due in the next 3 days</li>`);
    }
    
    // Default recommendation if no specific ones
    if (recommendations.length === 0) {
        recommendations.push('<li>✅ You\'re all caught up! Focus on strategic planning or skill development</li>');
    }
    
    return recommendations.join('');
}

// Calculate weekly progress
function calculateWeeklyProgress() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weeklyTasks = tasks.filter(task => {
        if (!task.createdAt) return false;
        const createdDate = new Date(task.createdAt);
        return createdDate >= weekStart && createdDate <= weekEnd;
    });
    
    const completedThisWeek = weeklyTasks.filter(task => task.status === 'complete').length;
    return weeklyTasks.length > 0 ? Math.round((completedThisWeek / weeklyTasks.length) * 100) : 0;
}

// Enhanced morning view with productivity tips
function showMorningProductivityTips() {
    const tipsModal = document.createElement('div');
    tipsModal.className = 'modal';
    tipsModal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2 class="modal-title">🌅 Morning Productivity Tips</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="productivity-tips">
                    <h3>🚀 Start Your Day Right</h3>
                    <div class="tips-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 1rem 0;">
                        <div class="tip-item">
                            <strong>1. Review Priorities</strong>
                            <p>Check your high-priority tasks and today's deadlines first</p>
                        </div>
                        <div class="tip-item">
                            <strong>2. Team Check-in</strong>
                            <p>Quick standup with team to align on daily goals</p>
                        </div>
                        <div class="tip-item">
                            <strong>3. Block Time</strong>
                            <p>Schedule focused work blocks for complex tasks</p>
                        </div>
                        <div class="tip-item">
                            <strong>4. Clear Blockers</strong>
                            <p>Identify and resolve any blocking issues early</p>
                        </div>
                    </div>
                    
                    <h3>📊 Today's Focus Strategy</h3>
                    <p>Based on your current tasks, here's your recommended approach:</p>
                    <ul>
                        ${generateMorningRecommendations()}
                    </ul>
                    
                    <h3>🎯 Quick Wins</h3>
                    <p>Tasks you can complete quickly to build momentum:</p>
                    <ul>
                        ${generateQuickWins()}
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(tipsModal);
    setTimeout(() => tipsModal.classList.add('show'), 10);
}

// Generate quick wins (tasks that can be completed quickly)
function generateQuickWins() {
    const quickWins = tasks.filter(t => {
        if (t.status === 'complete') return false;
        // Simple tasks (short description, low complexity indicators)
        const isSimple = !t.description || t.description.length < 50;
        const isLowPriority = t.priority === 'low';
        const isNotOverdue = !t.dueDate || new Date(t.dueDate) >= new Date();
        
        return isSimple && (isLowPriority || isNotOverdue);
    }).slice(0, 3); // Show top 3 quick wins
    
    if (quickWins.length === 0) {
        return '<li>✅ No quick wins available - focus on your priority tasks</li>';
    }
    
    return quickWins.map(task => 
        `<li>⚡ ${task.title} - ${task.priority} priority</li>`
    ).join('');
}

// Render Team Overview
function renderTeamOverview() {
    const teamOverviewContainer = document.getElementById('teamOverview');
    if (!teamOverviewContainer) return;
    
    // Group tasks by team member
    const teamMembers = {};
    tasks.forEach(task => {
        if (!task.owner || task.owner === 'Unassigned') return;
        
        if (!teamMembers[task.owner]) {
            teamMembers[task.owner] = {
                total: 0,
                completed: 0,
                inProgress: 0,
                overdue: 0,
                recentTasks: []
            };
        }
        
        teamMembers[task.owner].total++;
        
        if (task.status === 'complete') {
            teamMembers[task.owner].completed++;
        } else if (task.status === 'in-progress') {
            teamMembers[task.owner].inProgress++;
        } else if (task.dueDate && new Date(task.dueDate) < new Date()) {
            teamMembers[task.owner].overdue++;
        }
        
        // Add recent tasks (max 3)
        if (teamMembers[task.owner].recentTasks.length < 3) {
            teamMembers[task.owner].recentTasks.push(task);
        }
    });
    
    if (Object.keys(teamMembers).length === 0) {
        teamOverviewContainer.innerHTML = `
            <div class="team-member-card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <p class="text-gray-500">👥 No team members with assigned tasks found.</p>
            </div>
        `;
        return;
    }
    
    const teamOverviewHTML = Object.entries(teamMembers).map(([memberName, stats]) => {
        const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const statusClass = stats.overdue > 0 ? 'text-red-600' : 
                           completionRate >= 80 ? 'text-green-600' : 'text-yellow-600';
        
        const recentTasksHTML = stats.recentTasks.map(task => `
            <div class="team-task-item">
                ${task.title} - ${task.status}
            </div>
        `).join('');
        
        return `
            <div class="team-member-card">
                <div class="team-member-header">
                    <div class="team-member-avatar">${memberName.charAt(0).toUpperCase()}</div>
                    <div class="team-member-info">
                        <h4>${memberName}</h4>
                        <span class="team-member-status ${statusClass}">
                            ${stats.overdue > 0 ? '⚠️ Has overdue tasks' : 
                              completionRate >= 80 ? '✅ On track' : '🔄 In progress'}
                        </span>
                    </div>
                </div>
                
                <div class="team-member-stats">
                    <div class="team-stat">
                        <span class="team-stat-number">${stats.total}</span>
                        <span class="team-stat-label">Total</span>
                    </div>
                    <div class="team-stat">
                        <span class="team-stat-number">${stats.completed}</span>
                        <span class="team-stat-label">Done</span>
                    </div>
                    <div class="team-stat">
                        <span class="team-stat-number">${completionRate}%</span>
                        <span class="team-stat-label">Rate</span>
                    </div>
                </div>
                
                <div class="team-member-tasks">
                    <h5>Recent Tasks</h5>
                    ${recentTasksHTML || '<div class="team-task-item text-gray-400">No recent tasks</div>'}
                </div>
            </div>
        `;
    }).join('');
    
    teamOverviewContainer.innerHTML = teamOverviewHTML;
}

// Daily Goals Management
function addDailyGoal() {
    const goalInput = document.getElementById('goalInput');
    const goalText = goalInput.value.trim();
    
    if (!goalText) return;
    
    const newGoal = {
        id: Date.now(),
        text: goalText,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    dailyGoals.push(newGoal);
    saveDailyGoals();
    renderDailyGoals();
    
    goalInput.value = '';
    showNotification('Daily goal added!', 'success');
}

function toggleDailyGoal(goalId) {
    const goal = dailyGoals.find(g => g.id === goalId);
    if (goal) {
        goal.completed = !goal.completed;
        saveDailyGoals();
        renderDailyGoals();
    }
}

function deleteDailyGoal(goalId) {
    dailyGoals = dailyGoals.filter(g => g.id !== goalId);
    saveDailyGoals();
    renderDailyGoals();
    showNotification('Goal removed', 'info');
}

function saveDailyGoals() {
    localStorage.setItem('dailyGoals', JSON.stringify(dailyGoals));
}

function renderDailyGoals() {
    const dailyGoalsContainer = document.getElementById('dailyGoals');
    if (!dailyGoalsContainer) return;
    
    if (dailyGoals.length === 0) {
        dailyGoalsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <p>No goals set for today. Add your first goal above!</p>
            </div>
        `;
        return;
    }
    
    const goalsHTML = dailyGoals.map(goal => `
        <div class="daily-goal-item">
            <input type="checkbox" 
                   class="daily-goal-checkbox" 
                   ${goal.completed ? 'checked' : ''} 
                   onchange="toggleDailyGoal(${goal.id})">
            <span class="daily-goal-text ${goal.completed ? 'daily-goal-completed' : ''}">
                ${goal.text}
            </span>
            <button class="daily-goal-delete" onclick="deleteDailyGoal(${goal.id})" title="Remove goal">
                🗑️
            </button>
        </div>
    `).join('');
    
    dailyGoalsContainer.innerHTML = goalsHTML;
}

// Quick Action Functions
function showTeamStandup() {
    // Create a simple standup modal
    const standupModal = document.createElement('div');
    standupModal.className = 'modal';
    standupModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2 class="modal-title">👥 Team Standup</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="standup-content">
                    <h3>Yesterday's Progress</h3>
                    <ul>
                        <li>✅ Completed tasks: ${tasks.filter(t => t.status === 'complete').length}</li>
                        <li>🔄 In progress: ${tasks.filter(t => t.status === 'in-progress').length}</li>
                        <li>⚠️ Overdue: ${tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'complete').length}</li>
                    </ul>
                    
                    <h3>Today's Focus</h3>
                    <ul>
                        <li>🔥 High priority: ${tasks.filter(t => t.priority === 'high' && t.status !== 'complete').length}</li>
                        <li>📅 Due today: ${tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length}</li>
                    </ul>
                    
                    <h3>Team Updates</h3>
                    <p>Use this time to:</p>
                    <ul>
                        <li>Share progress on key initiatives</li>
                        <li>Identify blockers and dependencies</li>
                        <li>Align on today's priorities</li>
                        <li>Celebrate wins and achievements</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(standupModal);
    setTimeout(() => standupModal.classList.add('show'), 10);
}

function showWeeklyReview() {
    // Create a weekly review modal
    const weeklyModal = document.createElement('div');
    weeklyModal.className = 'modal';
    weeklyModal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2 class="modal-title">📊 Weekly Review</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="weekly-review-content">
                    <h3>This Week's Performance</h3>
                    <div class="weekly-stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 1rem 0;">
                        <div class="stat-item">
                            <strong>Tasks Completed:</strong> ${tasks.filter(t => t.status === 'complete').length}
                        </div>
                        <div class="stat-item">
                            <strong>Team Productivity:</strong> ${calculateTeamProductivity()}%
                        </div>
                        <div class="stat-item">
                            <strong>On-Time Delivery:</strong> ${calculateOnTimeDelivery()}%
                        </div>
                        <div class="stat-item">
                            <strong>Priority Focus:</strong> ${calculatePriorityFocus()}%
                        </div>
                    </div>
                    
                    <h3>Key Achievements</h3>
                    <ul>
                        <li>🎯 Completed ${tasks.filter(t => t.priority === 'high' && t.status === 'complete').length} high-priority tasks</li>
                        <li>👥 Team collaboration on ${countCollaborativeTasks()} projects</li>
                        <li>📈 Improved task completion rate by ${calculateImprovement()}%</li>
                    </ul>
                    
                    <h3>Next Week's Goals</h3>
                    <ul>
                        <li>Focus on reducing overdue tasks</li>
                        <li>Improve team communication</li>
                        <li>Streamline task prioritization process</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(weeklyModal);
    setTimeout(() => weeklyModal.classList.add('show'), 10);
}

// Helper functions for weekly review
function calculateTeamProductivity() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'complete').length;
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
}

function calculateOnTimeDelivery() {
    const dueTasks = tasks.filter(t => t.dueDate && t.status === 'complete');
    const onTimeTasks = dueTasks.filter(t => new Date(t.dueDate) >= new Date(t.createdAt));
    return dueTasks.length > 0 ? Math.round((onTimeTasks.length / dueTasks.length) * 100) : 0;
}

function calculatePriorityFocus() {
    const highPriorityTasks = tasks.filter(t => t.priority === 'high');
    const completedHighPriority = highPriorityTasks.filter(t => t.status === 'complete').length;
    return highPriorityTasks.length > 0 ? Math.round((completedHighPriority / highPriorityTasks.length) * 100) : 0;
}

function countCollaborativeTasks() {
    const teamMembers = new Set(tasks.map(t => t.owner).filter(o => o && o !== 'Unassigned'));
    return teamMembers.size;
}

function calculateImprovement() {
    // Simple mock improvement calculation
    return Math.floor(Math.random() * 20) + 5; // 5-25% improvement
}

// Render filtered tasks for different views
function renderFilteredTasks(filteredTasks) {
    const taskList = document.querySelector('#allTasksView .task-list');
    const taskHeader = taskList.querySelector('.task-header');
    
    // Update task count
    const taskCount = taskHeader.querySelector('p');
    taskCount.textContent = `Showing ${filteredTasks.length} of ${tasks.length} tasks`;
    
    // Clear existing tasks
    const existingTasks = taskList.querySelectorAll('.task-item:not(.task-header)');
    existingTasks.forEach(task => task.remove());
    
    // Render filtered tasks
    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });
    
    if (filteredTasks.length === 0) {
        const noTasksElement = document.createElement('div');
        noTasksElement.className = 'text-center py-8 text-gray-500';
        noTasksElement.innerHTML = `
            <div class="text-4xl mb-2">📝</div>
            <p>No tasks match your current filters</p>
            <button class="btn btn-primary mt-2" onclick="clearFilters()">Clear Filters</button>
        `;
        taskList.appendChild(noTasksElement);
    }
}

// Initialize morning view when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    const currentDate = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = currentDate.toLocaleDateString('en-US', dateOptions);
    
    // Load initial data (only if not already loaded)
    if (typeof window.dataLoaded === 'undefined') {
        window.dataLoaded = true;
        loadGHLTasks(false);
        loadGHLContacts();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize morning view (only if not already initialized)
    if (currentView === 'morning' && !window.morningViewInitialized) {
        window.morningViewInitialized = true;
        loadMorningViewData();
    }
    
    // Load daily goals
    renderDailyGoals();
}); 

// Render Team View
function renderTeamView() {
    // This will show a team-focused view similar to the morning view team overview
    // but with more detailed information
    const container = document.getElementById('userTaskGroups');
    if (!container) return;
    
    // Get team statistics
    const teamStats = calculateTeamStatistics();
    
    // Create team view HTML
    const teamViewHTML = `
        <div class="team-view-container">
            <div class="team-stats-overview mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="stat-card bg-white p-4 rounded-lg shadow">
                        <h3 class="text-sm font-medium text-gray-600">Team Members</h3>
                        <p class="text-2xl font-bold text-blue-600">${teamStats.totalMembers}</p>
                    </div>
                    <div class="stat-card bg-white p-4 rounded-lg shadow">
                        <h3 class="text-sm font-medium text-gray-600">Active Tasks</h3>
                        <p class="text-2xl font-bold text-green-600">${teamStats.activeTasks}</p>
                    </div>
                    <div class="stat-card bg-white p-4 rounded-lg shadow">
                        <h3 class="text-sm font-medium text-gray-600">Completion Rate</h3>
                        <p class="text-2xl font-bold text-purple-600">${teamStats.completionRate}%</p>
                    </div>
                    <div class="stat-card bg-white p-4 rounded-lg shadow">
                        <h3 class="text-sm font-medium text-gray-600">Overdue Items</h3>
                        <p class="text-2xl font-bold text-red-600">${teamStats.overdueTasks}</p>
                    </div>
                </div>
            </div>
            
            <div class="team-members-detailed">
                ${renderDetailedTeamMembers()}
            </div>
        </div>
    `;
    
    container.innerHTML = teamViewHTML;
}

// Calculate team statistics
function calculateTeamStatistics() {
    const teamMembers = new Set(tasks.map(task => task.owner).filter(owner => owner && owner !== 'Unassigned'));
    const totalMembers = teamMembers.size;
    
    const activeTasks = tasks.filter(task => task.status !== 'complete').length;
    const completedTasks = tasks.filter(task => task.status === 'complete').length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const overdueTasks = tasks.filter(task => {
        if (!task.dueDate || task.status === 'complete') return false;
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate < today;
    }).length;
    
    return {
        totalMembers,
        activeTasks,
        completionRate,
        overdueTasks
    };
}

// Render detailed team members
function renderDetailedTeamMembers() {
    const teamMembers = {};
    
    // Group tasks by team member
    tasks.forEach(task => {
        if (!task.owner || task.owner === 'Unassigned') return;
        
        if (!teamMembers[task.owner]) {
            teamMembers[task.owner] = {
                total: 0,
                completed: 0,
                inProgress: 0,
                overdue: 0,
                highPriority: 0,
                tasks: []
            };
        }
        
        teamMembers[task.owner].total++;
        teamMembers[task.owner].tasks.push(task);
        
        if (task.status === 'complete') {
            teamMembers[task.owner].completed++;
        } else if (task.status === 'in-progress') {
            teamMembers[task.owner].inProgress++;
        }
        
        if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'complete') {
            teamMembers[task.owner].overdue++;
        }
        
        if (task.priority === 'high') {
            teamMembers[task.owner].highPriority++;
        }
    });
    
    if (Object.keys(teamMembers).length === 0) {
        return `
            <div class="text-center text-gray-500 py-8">
                <p>No team members with assigned tasks found.</p>
            </div>
        `;
    }
    
    return Object.entries(teamMembers).map(([memberName, stats]) => {
        const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const statusClass = stats.overdue > 0 ? 'text-red-600' : 
                           completionRate >= 80 ? 'text-green-600' : 'text-yellow-600';
        
        const recentTasks = stats.tasks.slice(0, 5); // Show last 5 tasks
        
        return `
            <div class="team-member-detailed-card bg-white p-6 rounded-lg shadow mb-6">
                <div class="team-member-header mb-4">
                    <div class="flex items-center">
                        <div class="team-member-avatar-large w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold mr-4">
                            ${memberName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${memberName}</h3>
                            <p class="text-gray-600">${stats.total} total tasks</p>
                        </div>
                    </div>
                </div>
                
                <div class="team-member-stats-detailed grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="stat-item text-center">
                        <div class="text-2xl font-bold text-blue-600">${stats.total}</div>
                        <div class="text-sm text-gray-600">Total</div>
                    </div>
                    <div class="stat-item text-center">
                        <div class="text-2xl font-bold text-green-600">${stats.completed}</div>
                        <div class="text-sm text-gray-600">Completed</div>
                    </div>
                    <div class="stat-item text-center">
                        <div class="text-2xl font-bold text-yellow-600">${stats.inProgress}</div>
                        <div class="text-sm text-gray-600">In Progress</div>
                    </div>
                    <div class="stat-item text-center">
                        <div class="text-2xl font-bold text-red-600">${stats.overdue}</div>
                        <div class="text-sm text-gray-600">Overdue</div>
                    </div>
                </div>
                
                <div class="team-member-tasks-detailed">
                    <h4 class="font-semibold text-gray-800 mb-3">Recent Tasks</h4>
                    <div class="space-y-2">
                        ${recentTasks.map(task => `
                            <div class="task-item-mini flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex-1">
                                    <div class="font-medium text-gray-800">${task.title}</div>
                                    <div class="text-sm text-gray-600">${task.status} • ${task.priority} priority</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm text-gray-500">${task.dueDate ? formatDate(task.dueDate) : 'No due date'}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Morning Checklist Management
function updateMorningChecklist(checklistItem) {
    morningChecklist[checklistItem] = true;
    morningChecklist.lastUpdated = new Date().toISOString();
    saveMorningChecklist();
    
    // Check if all checklist items are completed
    checkMorningChecklistCompletion();
}

function checkMorningChecklistCompletion() {
    const requiredItems = ['routineCompleted', 'tasksReviewed', 'prioritiesSet'];
    const completedItems = requiredItems.filter(item => morningChecklist[item]);
    
    if (completedItems.length === requiredItems.length) {
        showNotification('🎉 Morning checklist completed! You\'re ready for a productive day!', 'success');
        
        // Record completion time
        morningChecklist.endTime = new Date().toISOString();
        saveMorningChecklist();
        
        // Show morning productivity summary
        setTimeout(() => {
            showMorningProductivitySummary();
        }, 2000);
    }
}

function saveMorningChecklist() {
    localStorage.setItem('morningChecklist', JSON.stringify(morningChecklist));
}

function resetMorningChecklist() {
    const today = new Date().toDateString();
    if (morningChecklist.date !== today) {
        morningChecklist = {
            date: today,
            routineCompleted: false,
            tasksReviewed: false,
            prioritiesSet: false,
            teamCheckin: false,
            startTime: new Date().toISOString(),
            endTime: null
        };
        saveMorningChecklist();
    }
}

function showMorningProductivitySummary() {
    const summaryModal = document.createElement('div');
    summaryModal.className = 'modal';
    summaryModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2 class="modal-title">🌅 Morning Productivity Summary</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="morning-summary">
                    <h3>✅ Morning Checklist Completed</h3>
                    <div class="checklist-summary">
                        <div class="checklist-item">
                            <span class="checklist-icon">✅</span>
                            <span>Morning routine completed</span>
                        </div>
                        <div class="checklist-item">
                            <span class="checklist-icon">✅</span>
                            <span>Tasks reviewed and prioritized</span>
                        </div>
                        <div class="checklist-item">
                            <span class="checklist-icon">✅</span>
                            <span>Daily priorities set</span>
                        </div>
                    </div>
                    
                    <h3>📊 Today's Action Plan</h3>
                    <div class="action-plan">
                        <p><strong>High Priority Tasks:</strong> ${tasks.filter(t => t.priority === 'high' && t.status !== 'complete').length}</p>
                        <p><strong>Due Today:</strong> ${tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length}</p>
                        <p><strong>Team Collaboration:</strong> ${countCollaborativeTasks()} tasks</p>
                    </div>
                    
                    <h3>🚀 Next Steps</h3>
                    <ul>
                        <li>Focus on your top 3 priority tasks</li>
                        <li>Schedule focused work blocks</li>
                        <li>Check in with team members</li>
                        <li>Review progress at midday</li>
                    </ul>
                    
                    <div class="morning-motivation">
                        <p class="motivation-text">🎯 You've set yourself up for success today. Stay focused and make it happen!</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(summaryModal);
    setTimeout(() => summaryModal.classList.add('show'), 10);
}

// Toast notification system
function showToast(message, type = 'success', title = '') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : 
                 type === 'error' ? '❌' : 
                 type === 'warning' ? '⚠️' : 'ℹ️';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Enhanced task filtering and search
function filterTasks() {
    const searchTerm = document.getElementById('taskSearch').value.toLowerCase();
    const priorityFilter = document.getElementById('priorityFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const ownerFilter = document.getElementById('ownerFilter').value;
    const dueDateFilter = document.getElementById('dueDateFilter').value;
    
    const filteredTasks = tasks.filter(task => {
        // Search filter
        const matchesSearch = !searchTerm || 
            task.title.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm));
        
        // Priority filter
        const matchesPriority = !priorityFilter || task.priority === priorityFilter;
        
        // Status filter
        const matchesStatus = !statusFilter || task.status === statusFilter;
        
        // Owner filter
        const matchesOwner = !ownerFilter || task.owner === ownerFilter;
        
        // Due date filter
        let matchesDueDate = true;
        if (dueDateFilter) {
            const today = new Date();
            const taskDate = new Date(task.dueDate);
            
            switch (dueDateFilter) {
                case 'today':
                    matchesDueDate = taskDate.toDateString() === today.toDateString();
                    break;
                case 'tomorrow':
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    matchesDueDate = taskDate.toDateString() === tomorrow.toDateString();
                    break;
                case 'this-week':
                    const endOfWeek = new Date(today);
                    endOfWeek.setDate(today.getDate() + 7);
                    matchesDueDate = taskDate >= today && taskDate <= endOfWeek;
                    break;
                case 'overdue':
                    matchesDueDate = taskDate < today && task.status !== 'complete';
                    break;
            }
        }
        
        return matchesSearch && matchesPriority && matchesStatus && matchesOwner && matchesDueDate;
    });
    
    renderFilteredTasks(filteredTasks);
}

// Enhanced task creation with better validation
function createTask(title, description, dueDate, priority, status, owner) {
    if (!title.trim()) {
        showToast('Task title is required', 'error');
        return null;
    }
    
    if (!dueDate) {
        showToast('Due date is required', 'error');
        return null;
    }
    
    const newTask = {
        id: Date.now(),
        title: title.trim(),
        description: description.trim(),
        dueDate,
        priority,
        status,
        owner,
        createdAt: new Date().toISOString()
    };
    
    tasks.push(newTask);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    
    showToast('Task created successfully', 'success');
    return newTask;
}

// Enhanced task update with validation
function updateTask(taskId, updates) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        showToast('Task not found', 'error');
        return false;
    }
    
    // Validate required fields
    if (updates.title && !updates.title.trim()) {
        showToast('Task title cannot be empty', 'error');
        return false;
    }
    
    if (updates.dueDate && !updates.dueDate) {
        showToast('Due date is required', 'error');
        return false;
    }
    
    // Update task
    tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
    localStorage.setItem('tasks', JSON.stringify(tasks));
    
    showToast('Task updated successfully', 'success');
    return true;
}

// Enhanced task deletion with confirmation
function deleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
        tasks = tasks.filter(t => t.id !== taskId);
        localStorage.setItem('tasks', JSON.stringify(tasks));
        
        showToast('Task deleted successfully', 'success');
        
        // Refresh current view
        if (currentView === 'allTasks') {
            renderAllTasksView();
        } else if (currentView === 'myTasks') {
            renderMyTasksView();
        } else if (currentView === 'overdue') {
            renderOverdueView();
        }
    }
}

// Enhanced task status toggle with better UX
function toggleTaskStatus(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newStatus = task.status === 'complete' ? 'incomplete' : 'complete';
    const success = updateTask(taskId, { status: newStatus });
    
    if (success) {
        // Update UI immediately
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            const statusBadge = taskElement.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = `status-badge status-${newStatus}`;
                statusBadge.textContent = newStatus.replace('-', ' ').toUpperCase();
            }
            
            // Update checkbox
            const checkbox = taskElement.querySelector('.task-checkbox');
            if (checkbox) {
                checkbox.checked = newStatus === 'complete';
            }
        }
        
        // Update counts and refresh views
        updateTaskCounts();
        if (currentView === 'morning') {
            renderMorningView();
        }
    }
}

// Enhanced data persistence with error handling
function saveTasksToStorage() {
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        return true;
    } catch (error) {
        console.error('Error saving tasks to localStorage:', error);
        showToast('Error saving tasks. Please check your browser storage.', 'error');
        return false;
    }
}

function loadTasksFromStorage() {
    try {
        const savedTasks = localStorage.getItem('tasks');
        if (savedTasks) {
            tasks = JSON.parse(savedTasks);
            return true;
        }
    } catch (error) {
        console.error('Error loading tasks from localStorage:', error);
        showToast('Error loading tasks. Starting with empty task list.', 'warning');
        tasks = [];
    }
    return false;
}

// Enhanced error handling for API calls
function handleApiError(error, context = 'operation') {
    console.error(`API Error in ${context}:`, error);
    
    let message = 'An unexpected error occurred';
    if (error.response) {
        message = `Server error: ${error.response.status}`;
    } else if (error.request) {
        message = 'Network error. Please check your connection.';
    } else if (error.message) {
        message = error.message;
    }
    
    showToast(message, 'error', 'API Error');
}

// Enhanced loading states
function showLoading(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const loadingState = element.querySelector('.loading-state');
        if (loadingState) {
            loadingState.remove();
        }
    }
}

// Enhanced form validation
function validateTaskForm() {
    const title = document.getElementById('taskTitle').value.trim();
    const dueDate = document.getElementById('taskDueDate').value;
    
    if (!title) {
        showToast('Task title is required', 'error');
        document.getElementById('taskTitle').focus();
        return false;
    }
    
    if (!dueDate) {
        showToast('Due date is required', 'error');
        document.getElementById('taskDueDate').focus();
        return false;
    }
    
    // Check if due date is in the past
    const selectedDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        if (!confirm('The selected due date is in the past. Are you sure you want to continue?')) {
            document.getElementById('taskDueDate').focus();
            return false;
        }
    }
    
    return true;
}

// Enhanced keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + N for new task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (currentView === 'morning') {
            addNewTask();
        }
    }
    
    // Ctrl/Cmd + F for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('taskSearch');
        if (searchInput && currentView === 'allTasks') {
            searchInput.focus();
        }
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        const modal = document.getElementById('taskModal');
        if (modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    }
});

// Enhanced event listeners for filtering
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for filters
    const filterInputs = ['taskSearch', 'priorityFilter', 'statusFilter', 'ownerFilter', 'dueDateFilter'];
    filterInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            if (inputId === 'taskSearch') {
                input.addEventListener('input', debounce(filterTasks, 300));
            } else {
                input.addEventListener('change', filterTasks);
            }
        }
    });
});

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 