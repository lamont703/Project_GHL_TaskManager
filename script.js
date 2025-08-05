// Global variables
let currentUser = null;
let tasks = [];
let contacts = [];
let currentFilter = 'all';
let currentSort = 'dueDate';
let editingTaskId = null;

// GoHighLevel API base URL
const GHL_API_BASE = 'http://localhost:3000';

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
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
    
    // Load initial data
    loadGHLData();
    
    // Set up event listeners
    setupEventListeners();
});

// Load data from GoHighLevel
async function loadGHLData() {
    try {
        // Load tasks and contacts simultaneously
        await Promise.all([
            loadGHLTasks(),
            loadGHLContacts()
        ]);
        
        // Update the display
        renderTasks();
        renderContacts();
        updateStatistics();
    } catch (error) {
        console.error('Error loading GHL data:', error);
        showNotification('Error loading data from GoHighLevel', 'error');
    }
}

// Load tasks from GoHighLevel
async function loadGHLTasks() {
    try {
        const response = await fetch(`${GHL_API_BASE}/tasks`);
        const data = await response.json();
        
        if (data.success) {
            // Convert GHL task format to our internal format
            tasks = data.tasks.map(task => ({
                id: task.id,
                title: task.title,
                description: task.body || '',
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
                priority: 'medium', // GHL doesn't have priority, so default to medium
                status: task.completed ? 'complete' : 'incomplete',
                owner: task.assignedTo || 'Unassigned',
                createdAt: task.createdAt || new Date().toISOString(),
                contactId: task.contactId,
                locationId: data.location_id
            }));
        } else {
            console.warn('Failed to load tasks from GHL:', data);
            tasks = [];
        }
    } catch (error) {
        console.error('Error loading GHL tasks:', error);
        tasks = [];
    }
}

// Load contacts from GoHighLevel
async function loadGHLContacts() {
    try {
        const response = await fetch(`${GHL_API_BASE}/contacts`);
        const data = await response.json();
        
        if (data.success && data.contacts && Array.isArray(data.contacts)) {
            contacts = data.contacts.map(contact => ({
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
    const container = document.getElementById('taskContainer');
    let filteredTasks = filterTasks();
    filteredTasks = sortTasks(filteredTasks);
    
    if (filteredTasks.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-gray-500">No tasks found</div>';
        return;
    }
    
    container.innerHTML = filteredTasks.map(task => createTaskHTML(task)).join('');
}

function filterTasks() {
    return tasks.filter(task => {
        switch (currentFilter) {
            case 'my':
                return task.owner === currentUser.name;
            case 'team':
                return task.owner !== currentUser.name;
            case 'overdue':
                return new Date(task.dueDate) < new Date() && task.status !== 'complete';
            default:
                return true;
        }
    });
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
    
    return `
        <div class="task-item ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
            <input type="checkbox" class="task-checkbox" ${task.status === 'complete' ? 'checked' : ''} 
                   onchange="toggleTaskStatus('${task.id}')">
            
            <div class="task-content">
                <div class="task-title">${task.title}</div>
                <div class="task-description">${task.description || 'No description'}</div>
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
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('inProgressTasks').textContent = inProgress;
    document.getElementById('overdueTasks').textContent = overdue;
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
        window.location.href = 'index.html';
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

// Auto-refresh every 30 seconds
setInterval(function() {
    updateStatistics();
}, 30000); 