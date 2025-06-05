// State management
let currentUser = null;
let currentNote = null;
let noteLocks = new Map();
let autosaveTimeout = null;
let newUserNameInput = null;
let currentNoteId = null;

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

document.getElementById('discardButton').addEventListener('click', discardChanges);
document.getElementById('reloadButton').addEventListener('click', reloadNote);

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
        const response = await fetch(`/api/notes/${currentNoteId}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user: currentUser })
        });

        if (!response.ok) {
            throw new Error('Failed to delete note');
        }

        // Release the lock
        await fetch(`/api/notes/${currentNoteId}/unlock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user: currentUser })
        });

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
        loadNotes();
    } else {
        showUserModal();
    }
}

// Close menu when clicking outside
document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && event.target !== menuButton && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

// Home button functionality
function goHome() {
    menu.classList.add('hidden');
    noteEditor.classList.add('hidden');
    notesList.classList.remove('hidden');
    loadNotes();
}

// User management
async function showUserModal() {
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
    await loadExistingUsers();
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
        existingUsers.innerHTML = users.map(user => `
            <button class="user-button" data-username="${user}">
                ${user}
            </button>
        `).join('');

        // Add click event listeners to all user buttons
        document.querySelectorAll('.user-button').forEach(button => {
            button.addEventListener('click', () => {
                const username = button.getAttribute('data-username');
                selectUser(username);
            });
        });
    } catch (error) {
        showFeedback('Error loading users', 'error');
    }
}

async function createUser() {
    const newUserName = document.getElementById('newUserName').value.trim();
    if (!newUserName) {
        showFeedback('Please enter a name', 'error');
        return;
    }

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newUserName })
        });

        if (response.ok) {
            currentUser = newUserName;
            localStorage.setItem('octonote_user', newUserName);
            closeUserModal();
            loadNotes();
            showFeedback('Welcome to OctoNote!', 'success');
        } else {
            const data = await response.json();
            showFeedback(data.error, 'error');
        }
    } catch (error) {
        showFeedback('Error creating user', 'error');
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
    } catch (error) {
        console.error('Error switching users:', error);
        showFeedback('Error switching users', 'error');
    }
}

// Notes management
async function loadNotes() {
    try {
        const response = await fetch('/api/notes');
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
        noteEditor.classList.remove('hidden');
        notesList.classList.add('hidden');
        
        // Setup autosave
        setupAutosave();
    } catch (error) {
        console.error('Error opening note:', error);
        showFeedback(error.message, 'error');
        // Make sure we're back in the notes list view
        noteEditor.classList.add('hidden');
        notesList.classList.remove('hidden');
    }
}

function setupAutosave(delay = 2000) {
    const saveDelay = delay; // Use provided delay or default to 2 seconds
    
    const noteContent = document.getElementById('noteContent');
    const noteTitle = document.getElementById('noteTitle');
    
    const saveHandler = () => {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => saveNote(false), saveDelay);
    };
    
    noteContent.addEventListener('input', saveHandler);
    noteTitle.addEventListener('input', saveHandler);
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

        // Only show success message for manual saves
        if (shouldClose) {
            showFeedback('Note saved successfully', 'success');
        }
        
        if (shouldClose) {
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
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showFeedback(error.message, 'error');
    }
}

function discardChanges() {
    if (confirm('Are you sure you want to discard your changes?')) {
        // Clear any pending autosave
        if (autosaveTimeout) {
            clearTimeout(autosaveTimeout);
            autosaveTimeout = null;
        }

        // Release the lock without saving
        if (currentNoteId) {
            fetch(`/api/notes/${currentNoteId}/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user: currentUser })
            }).catch(error => {
                console.error('Error releasing note lock:', error);
            }).finally(() => {
                // Reset state and UI regardless of lock release success
                currentNoteId = null;
                noteEditor.classList.add('hidden');
                notesList.classList.remove('hidden');
                loadNotes();
            });
        } else {
            // If no note was being edited, just reset the UI
            noteEditor.classList.add('hidden');
            notesList.classList.remove('hidden');
            loadNotes();
        }
    }
}

async function reloadNote() {
    if (currentNoteId) {
        try {
            // First release the current lock
            await fetch(`/api/notes/${currentNoteId}/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user: currentUser })
            });
            
            // Then reopen the note to get fresh content
            await openNote(currentNoteId);
            showFeedback('Note reloaded', 'success');
        } catch (error) {
            console.error('Error reloading note:', error);
            showFeedback('Error reloading note', 'error');
        }
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
        
        // Setup autosave with a longer delay for new notes
        setupAutosave(5000); // 5 second delay for new notes
        
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
            <button class="close-button" onclick="closeStatusModal()">Close</button>
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
    const feedback = document.createElement('div');
    feedback.className = `feedback ${type}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.remove();
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