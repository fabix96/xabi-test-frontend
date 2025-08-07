// API Configuration
const API_CONFIG = {
    baseUrl: 'http://localhost:5000/api',
    endpoints: {
        meters: '/meters'
    }
};

// Global state
let meters = [];
let currentDeleteId = null;

// DOM Elements
const elements = {
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    meterForm: document.getElementById('meter-form'),
    metersTable: document.getElementById('meters-table'),
    metersTbody: document.getElementById('meters-tbody'),
    loadingIndicator: document.getElementById('loading-indicator'),
    noMeters: document.getElementById('no-meters'),
    notifications: document.getElementById('notifications'),
    deleteModal: document.getElementById('delete-modal'),
    deleteMeterIdSpan: document.getElementById('delete-meter-id'),
    submitBtn: document.getElementById('submit-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
    totalMeters: document.getElementById('total-meters'),
    activeConnections: document.getElementById('active-connections')
};

// API Functions
async function fetchMeters() {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.meters}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch meters');
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching meters:', error);
        throw error;
    }
}

async function createMeter(meterData) {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.meters}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(meterData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to create meter');
        }
        
        return data;
    } catch (error) {
        console.error('Error creating meter:', error);
        throw error;
    }
}

async function deleteMeter(meterId) {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.meters}/${meterId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to delete meter');
        }
        
        return data;
    } catch (error) {
        console.error('Error deleting meter:', error);
        throw error;
    }
}

// Notification System
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close" onclick="closeNotification(this)">&times;</button>
    `;
    
    elements.notifications.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            closeNotification(notification.querySelector('.notification-close'));
        }
    }, duration);
}

function closeNotification(closeButton) {
    const notification = closeButton.parentElement;
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 300);
}

// Tab Navigation
function switchTab(targetTab) {
    // Update nav tabs
    elements.navTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === targetTab) {
            tab.classList.add('active');
        }
    });
    
    // Update tab content
    elements.tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === targetTab) {
            content.classList.add('active');
        }
    });
    
    // Load meters when switching to meter-list tab
    if (targetTab === 'meter-list') {
        loadMeters();
    }
}

// Dashboard Functions
function updateDashboardStats() {
    elements.totalMeters.textContent = meters.length;
    // Simulate active connections (in real app, this would come from API)
    elements.activeConnections.textContent = meters.filter(meter => 
        meter.last_inserted_timestamp !== null
    ).length;
}

// Table Management
async function loadMeters() {
    try {
        showLoadingState(true);
        const response = await fetchMeters();
        
        if (response.success) {
            meters = response.data || [];
            renderMetersTable();
            updateDashboardStats();
        } else {
            throw new Error(response.message || 'Failed to load meters');
        }
    } catch (error) {
        console.error('Load meters error:', error);
        showNotification('Error loading meters: ' + error.message, 'error');
        showEmptyState();
    } finally {
        showLoadingState(false);
    }
}

function renderMetersTable() {
    if (meters.length === 0) {
        showEmptyState();
        return;
    }
    
    elements.noMeters.classList.add('hidden');
    elements.metersTable.classList.remove('hidden');
    
    elements.metersTbody.innerHTML = meters.map(meter => `
        <tr>
            <td><strong>${escapeHtml(meter.meter_id)}</strong></td>
            <td><code>${escapeHtml(meter.gateway_key)}</code></td>
            <td><code>${escapeHtml(meter.gateway_token)}</code></td>
            <td>${meter.parameter_id}</td>
            <td>${formatTimestamp(meter.last_inserted_timestamp)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn--danger btn--xs" onclick="showDeleteModal('${meter._id}', '${escapeHtml(meter.meter_id)}')">
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function showEmptyState() {
    elements.metersTable.classList.add('hidden');
    elements.noMeters.classList.remove('hidden');
}

function showLoadingState(loading) {
    if (loading) {
        elements.loadingIndicator.classList.remove('hidden');
        elements.metersTable.classList.add('hidden');
        elements.noMeters.classList.add('hidden');
    } else {
        elements.loadingIndicator.classList.add('hidden');
    }
}

// Form Management
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const meterData = {
        meter_id: formData.get('meter_id').trim(),
        gateway_key: formData.get('gateway_key').trim(),
        gateway_token: formData.get('gateway_token').trim(),
        parameter_id: parseInt(formData.get('parameter_id'))
    };
    
    // Validate form data
    if (!validateMeterData(meterData)) {
        return;
    }
    
    try {
        setSubmitButtonLoading(true);
        
        const response = await createMeter(meterData);
        
        if (response.success) {
            showNotification('Meter registered successfully!', 'success');
            elements.meterForm.reset();
            
            // Switch to meter list and refresh
            switchTab('meter-list');
            await loadMeters();
        } else {
            throw new Error(response.message || 'Failed to register meter');
        }
    } catch (error) {
        let errorMessage = 'Failed to register meter';
        
        if (error.message.includes('duplicate') || error.message.includes('already exists')) {
            errorMessage = 'A meter with this ID already exists';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        setSubmitButtonLoading(false);
    }
}

function validateMeterData(data) {
    const errors = [];
    
    if (!data.meter_id || data.meter_id.length < 3) {
        errors.push('Meter ID must be at least 3 characters long');
    }
    
    if (!data.gateway_key || data.gateway_key.length < 5) {
        errors.push('Gateway Key must be at least 5 characters long');
    }
    
    if (!data.gateway_token || data.gateway_token.length < 5) {
        errors.push('Gateway Token must be at least 5 characters long');
    }
    
    if (!data.parameter_id || data.parameter_id < 1) {
        errors.push('Parameter ID must be a positive number');
    }
    
    if (errors.length > 0) {
        showNotification('Validation errors: ' + errors.join(', '), 'error');
        return false;
    }
    
    return true;
}

function setSubmitButtonLoading(loading) {
    const btnText = elements.submitBtn.querySelector('.btn-text');
    const btnLoading = elements.submitBtn.querySelector('.btn-loading');
    
    elements.submitBtn.disabled = loading;
    
    if (loading) {
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        btnLoading.classList.add('visible');
    } else {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        btnLoading.classList.remove('visible');
    }
}

// Delete Modal Management
function showDeleteModal(meterId, meterIdText) {
    currentDeleteId = meterId;
    elements.deleteMeterIdSpan.textContent = meterIdText;
    elements.deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    elements.deleteModal.classList.add('hidden');
    currentDeleteId = null;
}

async function confirmDelete() {
    if (!currentDeleteId) return;
    
    try {
        setDeleteButtonLoading(true);
        
        const response = await deleteMeter(currentDeleteId);
        
        if (response.success) {
            showNotification('Meter deleted successfully!', 'success');
            closeDeleteModal();
            await loadMeters();
        } else {
            throw new Error(response.message || 'Failed to delete meter');
        }
    } catch (error) {
        showNotification('Error deleting meter: ' + error.message, 'error');
    } finally {
        setDeleteButtonLoading(false);
    }
}

function setDeleteButtonLoading(loading) {
    const deleteText = elements.confirmDeleteBtn.querySelector('.delete-text');
    const deleteLoading = elements.confirmDeleteBtn.querySelector('.delete-loading');
    
    elements.confirmDeleteBtn.disabled = loading;
    
    if (loading) {
        deleteText.classList.add('hidden');
        deleteLoading.classList.remove('hidden');
        deleteLoading.classList.add('visible');
    } else {
        deleteText.classList.remove('hidden');
        deleteLoading.classList.add('hidden');
        deleteLoading.classList.remove('visible');
    }
}

// Refresh button management
function setRefreshButtonLoading(loading) {
    const refreshText = elements.refreshBtn.querySelector('.refresh-text');
    const refreshLoading = elements.refreshBtn.querySelector('.refresh-loading');
    
    elements.refreshBtn.disabled = loading;
    
    if (loading) {
        refreshText.classList.add('hidden');
        refreshLoading.classList.remove('hidden');
        refreshLoading.classList.add('visible');
    } else {
        refreshText.classList.remove('hidden');
        refreshLoading.classList.add('hidden');
        refreshLoading.classList.remove('visible');
    }
}

// Utility Functions
function formatTimestamp(timestamp) {
    if (!timestamp) return '<span class="status status--info">Never</span>';
    
    try {
        const date = new Date(timestamp);
        return date.toLocaleString();
    } catch (error) {
        return '<span class="status status--error">Invalid</span>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the application
function initializeApp() {
    // Set up tab navigation
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(tab.dataset.tab);
        });
    });
    
    // Set up form submission
    if (elements.meterForm) {
        elements.meterForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Set up refresh button
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', async () => {
            setRefreshButtonLoading(true);
            try {
                await loadMeters();
            } catch (error) {
                console.error('Refresh error:', error);
            } finally {
                setRefreshButtonLoading(false);
            }
        });
    }
    
    // Modal close on escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeDeleteModal();
        }
    });
    
    // Try to load initial meters data (non-blocking)
    try {
        loadMeters().catch(error => {
            console.error('Initial load failed:', error);
            // Don't throw - app should still work even if API is down
        });
    } catch (error) {
        console.error('Failed to start initial load:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeApp();
    } catch (error) {
        console.error('App initialization error:', error);
    }
});

// CSS animation for slideOut
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Global functions (called from HTML)
window.switchTab = switchTab;
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.closeNotification = closeNotification;