// State management
let currentUser = null;
let currentNote = null;
let noteLocks = new Map();
let newUserNameInput = null;
let currentNoteId = null;
let userToDelete = null;
let undoStack = [];  // Array to store multiple undo states
let currentContent = null;  // Store the current content
let changeTimeout = null;   // For debouncing changes
const MAX_UNDO_LEVELS = 10; // Maximum number of undo states to keep
let hasUnsavedChanges = false; // Track if there are unsaved changes
let pendingAction = null; // Store the action to take after user decision

// DOM Elements
const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');
const notesList = document.getElementById('notesList');
const noteEditor = document.getElementById('noteEditor');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const noteMeta = document.getElementById('noteMeta');
const userModal = document.getElementById('userModal');
const statusModal = document.getElementById('statusModal');
const homeButton = document.getElementById('homeButton');
const transferDialog = document.getElementById('transferDialog');
const transferUserSelect = document.getElementById('transferUserSelect');
const transferNoteCount = document.getElementById('transferNoteCount');
const cancelTransferButton = document.getElementById('cancelTransferButton');
const confirmTransferButton = document.getElementById('confirmTransferButton');
const unsavedChangesModal = document.getElementById('unsavedChangesModal');
const saveChangesButton = document.getElementById('saveChangesButton');
const discardChangesButton = document.getElementById('discardChangesButton');
const continueEditingButton = document.getElementById('continueEditingButton');

// Ensure note editor is hidden on page load
noteEditor.classList.add('hidden');

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);

// Menu toggle
function toggleMenu(event) {
    event.stopPropagation(); // Prevent event from bubbling up
    menu.classList.toggle('hidden');
}

menuButton.addEventListener('click', toggleMenu);
homeButton.addEventListener('click', goHome);

// Menu buttons
document.getElementById('newNoteButton').addEventListener('click', () => {
    if (!currentUser) {
        showFeedback('Please select a user first', 'error');
        showUserModal();
        return;
    }
    menu.classList.add('hidden');
    createNewNote();
});

document.getElementById('statusButton').addEventListener('click', () => {
    menu.classList.add('hidden');
    showStatus();
});

document.getElementById('userSwitchButton').addEventListener('click', () => {
    menu.classList.add('hidden');
    showUserModal();
});

// Note action buttons
document.getElementById('saveButton').addEventListener('click', () => {
    saveNote(true);
});

// Add undo button functionality
document.getElementById('undoButton').addEventListener('click', undoLastChange);

// Add copy button functionality
document.getElementById('copyButton').addEventListener('click', copyNoteContent);

// Add delete button functionality
const deleteButton = document.getElementById('deleteButton');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');

deleteButton.addEventListener('click', () => {
    deleteConfirmModal.classList.remove('hidden');
});

cancelDeleteButton.addEventListener('click', () => {
    deleteConfirmModal.classList.add('hidden');
});

confirmDeleteButton.addEventListener('click', async () => {
    if (!currentNoteId) return;

    try {
        // Release the lock first
        await fetch(`/api/notes/${currentNoteId}/unlock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user: currentUser })
        });

        // Then attempt to delete the note
        const response = await fetch(`/api/notes/${currentNoteId}?user=${encodeURIComponent(currentUser)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            // If deletion fails after unlock, re-acquire lock if necessary? Or just show error?
            // For now, just throw error.
            throw new Error('Failed to delete note');
        }

        // Update UI
        deleteConfirmModal.classList.add('hidden');
        noteEditor.classList.add('hidden');
        notesList.classList.remove('hidden');
        currentNoteId = null;
        
        // Refresh the notes list
        await loadNotes();
        
        showFeedback('Note deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting note:', error);
        showFeedback(error.message, 'error');
        // If deletion failed, we should probably try to re-acquire the lock
        // to prevent other users from editing a note that couldn't be deleted.
        // This is a more complex error handling scenario.
    }
});

// Initialize the app
async function initializeApp() {
    // Add createUserButton event listener after DOM is loaded
    document.getElementById('createUserButton').addEventListener('click', createUser);
    
    // Check for existing user in localStorage
    const savedUser = localStorage.getItem('octonote_user');
    if (savedUser) {
        currentUser = savedUser;
        await loadNotes(true);
        updateCurrentUserDisplay();
    } else {
        showUserModal();
    }

    // Add visibility change handler to refresh content when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadNotes(true);
        }
    });
}

// Close menu when clicking outside
document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && event.target !== menuButton && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

// Home button functionality
async function goHome() {
    const proceed = await checkUnsavedChanges(() => {
        menu.classList.add('hidden');
        noteEditor.classList.add('hidden');
        notesList.classList.remove('hidden');
        loadNotes();
    });
    
    if (proceed) {
        menu.classList.add('hidden');
        noteEditor.classList.add('hidden');
        notesList.classList.remove('hidden');
        loadNotes();
    }
}

// User management
async function showUserModal() {
    const proceed = await checkUnsavedChanges(() => {
        menu.classList.add('hidden');
        userModal.classList.remove('hidden');
        
        // Get the input field
        newUserNameInput = document.getElementById('newUserName');
        newUserNameInput.value = '';
        
        // Add Enter key handler for the input field
        newUserNameInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                createUser();
            }
        });
        
        // Load existing users
        loadExistingUsers();
    });
    
    if (proceed) {
        menu.classList.add('hidden');
        userModal.classList.remove('hidden');
        
        // Get the input field
        newUserNameInput = document.getElementById('newUserName');
        newUserNameInput.value = '';
        
        // Add Enter key handler for the input field
        newUserNameInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                createUser();
            }
        });
        
        // Load existing users
        loadExistingUsers();
    }
}

function closeUserModal() {
    if (newUserNameInput && newUserNameInput.dataset.enterHandler) {
        newUserNameInput.removeEventListener('keypress', newUserNameInput.dataset.enterHandler);
        delete newUserNameInput.dataset.enterHandler;
    }
    userModal.classList.add('hidden');
}

async function loadExistingUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const existingUsers = document.getElementById('existingUsers');
        existingUsers.innerHTML = `<div class="user-suggestions-container">${users.map(user => `
            <div class="user-name-container">
                <button class="user-name-option" data-username="${user}">${user}</button>
                <button class="delete-user-button" data-username="${user}">×</button>
            </div>
        `).join('')}</div>`;

        // Add click handlers for user selection
        document.querySelectorAll('.user-name-option').forEach(button => {
            button.addEventListener('click', () => selectUser(button.dataset.username));
        });

        // Add click handlers for user deletion
        document.querySelectorAll('.delete-user-button').forEach(button => {
            button.addEventListener('click', () => showTransferDialog(button.dataset.username));
        });

        // Check if we have a saved user
        const savedUser = localStorage.getItem('octonote_user');
        if (savedUser) {
            currentUser = savedUser;
            loadNotes();
        }
        updateCurrentUserDisplay();
    } catch (error) {
        console.error('Error loading users:', error);
        showFeedback('Failed to load users', 'error');
    }
}

async function createUser() {
    const username = newUserNameInput.value.trim();
    if (!username) {
        showFeedback('Please enter a username', 'error');
        return;
    }

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: username })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create user');
        }

        const user = await response.json();
        currentUser = username;
        localStorage.setItem('octonote_user', username);
        updateCurrentUserDisplay();
        
        // Refresh the list of existing users
        await loadExistingUsers();
        
        // Clear the input field for the next user
        newUserNameInput.value = '';
        
        // Show success message
        showFeedback('User created successfully', 'success');
        
        // Load notes for the new user
        await loadNotes();
        
        // Keep the modal open so user can see the updated list
        // and switch between users if desired
    } catch (error) {
        console.error('Error creating user:', error);
        showFeedback(error.message, 'error');
    }
}

async function selectUser(username) {
    try {
        // Release any existing note lock when switching users
        if (currentNoteId) {
            try {
                await fetch(`/api/notes/${currentNoteId}/unlock`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user: currentUser })
                });
            } catch (error) {
                console.error('Error releasing note lock:', error);
                // Continue with user switch even if unlock fails
            }
        }
        
        // Update user first
        currentUser = username;
        localStorage.setItem('octonote_user', username);
        currentNoteId = null;
        
        // Hide the user modal and show the notes list
        userModal.classList.add('hidden');
        notesList.classList.remove('hidden');
        noteEditor.classList.add('hidden');
        
        // Load the notes for the selected user
        await loadNotes();
        showFeedback(`Switched to user: ${username}`, 'success');
        updateCurrentUserDisplay();
    } catch (error) {
        console.error('Error switching users:', error);
        showFeedback('Error switching users', 'error');
    }
}

// Notes management
async function loadNotes(forceRefresh = false) {
    try {
        // Add cache-busting parameter if force refresh is requested
        const url = forceRefresh ? `/api/notes?t=${Date.now()}` : '/api/notes';
        const response = await fetch(url, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch notes');
        }
        
        const notes = await response.json();
        console.log('Loaded notes:', notes);
        
        if (notes.length === 0) {
            notesList.innerHTML = `
                <div class="no-notes">
                    <p>No notes yet.</p>
                    <p>Use the menu to create one!</p>
                </div>`;
            return;
        }
        
        notesList.innerHTML = notes.map(note => `
            <div class="note-card" data-note-id="${note.id}">
                <h3 class="note-title">${note.title || 'Untitled Note'}</h3>
                <p class="note-meta">
                    Last edited by <strong>${note.lastEditedBy || 'Unknown'}</strong> on<br>
                    ${formatDate(note.lastEdited)}
                </p>
            </div>
        `).join('');

        // Add click handlers to note cards
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', () => {
                const noteId = card.dataset.noteId;
                openNote(noteId);
            });
        });
    } catch (error) {
        console.error('Error loading notes:', error);
        showFeedback('Error loading notes', 'error');
    }
}

async function openNote(noteId) {
    try {
        // First check if the note exists and get its content
        const response = await fetch(`/api/notes/${noteId}?user=${encodeURIComponent(currentUser)}`);
        if (!response.ok) {
            const error = await response.json();
            if (error.error === 'Note is locked') {
                showFeedback(`This note is being edited by ${error.user}`, 'error');
                return;
            }
            throw new Error(error.error || 'Failed to fetch note');
        }

        const note = await response.json();
        
        // Update UI first
        currentNoteId = noteId;
        noteTitle.value = note.title;
        noteContent.value = note.content;
        
        // Ensure notes list is hidden and editor is visible
        notesList.classList.add('hidden');
        noteEditor.classList.remove('hidden');
        
        // Setup change tracking
        setupChangeTracking();
    } catch (error) {
        console.error('Error opening note:', error);
        showFeedback(error.message, 'error');
        // Make sure we're back in the notes list view
        noteEditor.classList.add('hidden');
        notesList.classList.remove('hidden');
    }
}

function undoLastChange() {
    if (undoStack.length === 0) {
        showToast('Nothing to undo');
        return;
    }

    const noteContent = document.getElementById('noteContent');
    
    // Get the last state from the undo stack
    const previousState = undoStack.pop();
    
    // Store current state at the beginning of the stack (for redo)
    undoStack.unshift(currentContent);
    
    // Update current content and editor
    currentContent = previousState;
    noteContent.value = currentContent;
}

function setupChangeTracking() {
    const noteContent = document.getElementById('noteContent');
    const noteTitle = document.getElementById('noteTitle');
    
    // Store initial state when opening a note
    currentContent = noteContent.value;
    undoStack = []; // Reset undo stack when opening a new note
    hasUnsavedChanges = false;
    
    const handleChange = () => {
        const newContent = noteContent.value;
        
        // Clear any pending change timeout
        if (changeTimeout) {
            clearTimeout(changeTimeout);
        }
        
        // Set a new timeout to batch changes
        changeTimeout = setTimeout(() => {
            // Only update states if content has actually changed
            if (newContent !== currentContent) {
                // Add current state to undo stack
                undoStack.push(currentContent);
                
                // Limit the undo stack size
                if (undoStack.length > MAX_UNDO_LEVELS) {
                    undoStack.shift(); // Remove oldest state
                }
                
                // Update current content and mark as unsaved
                currentContent = newContent;
                hasUnsavedChanges = true;
            }
        }, 500); // Wait 500ms after last keystroke before considering it a "change"
    };
    
    // Remove any existing event listeners
    noteContent.removeEventListener('input', handleChange);
    noteTitle.removeEventListener('input', handleChange);
    
    // Add new event listeners
    noteContent.addEventListener('input', handleChange);
    noteTitle.addEventListener('input', handleChange);
}

async function saveNote(shouldClose = false) {
    if (!currentNoteId) return;

    try {
        const title = noteTitle.value;
        const content = noteContent.value;

        console.log('Saving note:', { id: currentNoteId, title, content });

        const response = await fetch(`/api/notes/${currentNoteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                content: content,
                user: currentUser
            })
        });

        if (!response.ok) {
            const error = await response.json();
            if (error.error === 'Note is locked') {
                showFeedback(`This note is being edited by ${error.user}`, 'error');
                return;
            }
            throw new Error(error.error || 'Failed to save note');
        }

        // Update current content to match saved state and reset unsaved flag
        currentContent = content;
        hasUnsavedChanges = false;

        if (shouldClose) {
            showFeedback('Note saved successfully', 'success');
            
            // Release the lock
            await fetch(`/api/notes/${currentNoteId}/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user: currentUser })
            });

            // Return to notes list
            currentNoteId = null;
            noteEditor.classList.add('hidden');
            notesList.classList.remove('hidden');
            await loadNotes();
        } else {
            showFeedback('Note saved successfully', 'success');
            // If not closing, ensure notes list stays hidden and editor stays visible
            notesList.classList.add('hidden');
            noteEditor.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showFeedback(error.message, 'error');
    }
}

// Create new note
async function createNewNote() {
    if (!currentUser) {
        showFeedback('Please select a user first', 'error');
        showUserModal();
        return;
    }

    try {
        // First create the note
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Note Title',
                content: 'Replace this with your note...',
                user: currentUser
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create note');
        }

        currentNoteId = data.id;
        
        // Then acquire the lock
        const lockResponse = await fetch(`/api/notes/${currentNoteId}/lock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user: currentUser })
        });

        if (!lockResponse.ok) {
            throw new Error('Failed to acquire note lock');
        }
        
        // Update UI
        noteTitle.value = 'Note Title';
        noteContent.value = 'Replace this with your note...';
        noteEditor.classList.remove('hidden');
        notesList.classList.add('hidden');
        
        // Setup change tracking
        setupChangeTracking();
        
        showFeedback('New note created', 'success');
    } catch (error) {
        console.error('Error creating note:', error);
        showFeedback(error.message, 'error');
        // Ensure we're back in the notes list view if creation failed
        noteEditor.classList.add('hidden');
        notesList.classList.remove('hidden');
    }
}

// Copy note content
function copyNoteContent() {
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value;
    const textToCopy = `${title}\n\n${content}`;
    
    // Use the modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                showFeedback('Note content copied to clipboard', 'success');
            })
            .catch(() => {
                // Fallback for clipboard API failure
                fallbackCopy();
            });
    } else {
        // Fallback for browsers that don't support clipboard API
        fallbackCopy();
    }
}

function fallbackCopy() {
    const textArea = document.createElement('textarea');
    textArea.value = `${document.getElementById('noteTitle').value}\n\n${document.getElementById('noteContent').value}`;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showFeedback('Note content copied to clipboard', 'success');
    } catch (err) {
        showFeedback('Failed to copy note content', 'error');
    }
    document.body.removeChild(textArea);
}

async function showStatus() {
    try {
        menu.classList.add('hidden');
        const response = await fetch('/api/status');
        const status = await response.json();
        const statusContent = document.getElementById('statusContent');
        statusContent.innerHTML = `
            <div class="status-info">
                <p><strong>Server Status:</strong> ${status.status}</p>
                <p><strong>Uptime:</strong> ${status.uptime}</p>
                <p><strong>Memory Usage:</strong> ${status.memory}</p>
                <p><strong>Active Users:</strong> ${status.activeUsers}</p>
                <p><strong>Total Notes:</strong> ${status.totalNotes}</p>
            </div>
            <div class="modal-actions">
                <button class="modal-button" onclick="closeStatusModal()">Close</button>
            </div>
        `;
        statusModal.classList.remove('hidden');
    } catch (error) {
        showFeedback('Error loading status', 'error');
    }
}

function closeStatusModal() {
    statusModal.classList.add('hidden');
}

// Utility functions
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        // Format: WED 04 June 2025 at 23:32
        const options = {
            weekday: 'short',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        return date.toLocaleString('en-US', options).replace(',', '');
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
}

function showFeedback(message, type) {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // Add click handler to dismiss toast
    toast.addEventListener('click', () => {
        toast.remove();
    });
    
    toastContainer.appendChild(toast);
    
    // Remove the toast after animation completes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === userModal) {
        userModal.classList.add('hidden');
    }
    if (event.target === statusModal) {
        statusModal.classList.add('hidden');
    }
    if (event.target === deleteConfirmModal) {
        deleteConfirmModal.classList.add('hidden');
    }
});

async function showTransferDialog(username) {
    try {
        // Get note count for the user
        const response = await fetch(`/api/notes/count/${username}`);
        const data = await response.json();
        const noteCount = data.count || 0;  // Default to 0 if undefined

        userToDelete = username;
        transferNoteCount.innerHTML = `
            <p style="text-align: center; margin-bottom: 0.5rem;">${username} has created <strong>${noteCount}</strong> note${noteCount !== 1 ? 's' : ''}</p>
            <p style="text-align: center;">Who should I transfer ${username}'s notes to, before deleting this user?</p>
        `;

        // Get all users except the one being deleted
        const usersResponse = await fetch('/api/users');
        const users = await usersResponse.json();
        const otherUsers = users.filter(user => user !== username);

        // Populate the dropdown
        transferUserSelect.innerHTML = otherUsers.length > 0 
            ? `<option value="">Select a user...</option>${otherUsers.map(user => 
                `<option value="${user}">${user}</option>`).join('')}`
            : '<option value="" disabled>No other users available</option>';

        // Enable/disable the dropdown and confirm button based on whether there are other users
        transferUserSelect.disabled = otherUsers.length === 0;
        confirmTransferButton.disabled = otherUsers.length === 0;

        // Show the dialog
        transferDialog.classList.remove('hidden');
    } catch (error) {
        showFeedback('Error loading user data', 'error');
    }
}

// Add event listeners for transfer dialog
cancelTransferButton.addEventListener('click', () => {
    transferDialog.classList.add('hidden');
    userToDelete = null;
});

confirmTransferButton.addEventListener('click', async () => {
    if (!userToDelete) return;

    const newOwner = transferUserSelect.value;
    if (!newOwner) {
        showFeedback('Please select a user to transfer notes to', 'error');
        return;
    }

    try {
        // First transfer the notes
        const transferResponse = await fetch(`/api/notes/transfer/${userToDelete}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newOwner })
        });

        if (!transferResponse.ok) {
            throw new Error('Failed to transfer notes');
        }

        // Then delete the user
        const deleteResponse = await fetch(`/api/users/${userToDelete}`, {
            method: 'DELETE'
        });

        if (!deleteResponse.ok) {
            throw new Error('Failed to delete user');
        }

        // Close the transfer dialog
        transferDialog.classList.add('hidden');
        
        // If the deleted user was the current user, clear session and show user selection
        if (userToDelete === currentUser) {
            currentUser = null;
            localStorage.removeItem('octonote_user');
            currentNoteId = null;
            
            const userModal = document.getElementById('userModal');
            userModal.onclick = (event) => {
                if (event.target === userModal) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };
            
            const modalContent = userModal.querySelector('.modal-content');
            const title = modalContent.querySelector('h2');
            title.textContent = 'Select a User to Continue';
            
            const message = document.createElement('p');
            message.style.textAlign = 'center';
            message.style.marginBottom = '1rem';
            message.style.color = 'white';
            message.textContent = 'The previous user has been deleted. Please select a user to continue.';
            title.after(message);
            
            userModal.classList.remove('hidden');
            notesList.classList.add('hidden');
            noteEditor.classList.add('hidden');
            updateCurrentUserDisplay();
        }

        // Reset userToDelete and refresh the user list
        userToDelete = null;
        await loadExistingUsers();
        showFeedback('User deleted successfully', 'success');
    } catch (error) {
        showFeedback(error.message, 'error');
    }
});

function updateCurrentUserDisplay() {
    const currentUserDisplay = document.getElementById('currentUserDisplay');
    if (currentUser) {
        currentUserDisplay.innerHTML = `Active User: <strong>${currentUser}</strong>`;
        currentUserDisplay.classList.add('visible');
    } else {
        currentUserDisplay.textContent = '';
        currentUserDisplay.classList.remove('visible');
    }
}

// Add event listeners for unsaved changes modal
saveChangesButton.addEventListener('click', async () => {
    unsavedChangesModal.classList.add('hidden');
    if (pendingAction) {
        await saveNote(true);
        pendingAction();
        pendingAction = null;
    }
});

discardChangesButton.addEventListener('click', () => {
    unsavedChangesModal.classList.add('hidden');
    if (pendingAction) {
        pendingAction();
        pendingAction = null;
    }
    hasUnsavedChanges = false;
});

continueEditingButton.addEventListener('click', () => {
    unsavedChangesModal.classList.add('hidden');
    pendingAction = null;
});

// Function to check for unsaved changes and show warning if needed
async function checkUnsavedChanges(action) {
    if (hasUnsavedChanges) {
        pendingAction = action;
        unsavedChangesModal.classList.remove('hidden');
        return false;
    }
    return true;
} 