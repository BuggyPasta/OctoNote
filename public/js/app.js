// State management
let currentUser = null;
let currentNote = null;
let noteLocks = new Map();
let autosaveTimeout = null;

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
document.getElementById('backButton').addEventListener('click', backToList);
document.getElementById('saveButton').addEventListener('click', saveNote);
document.getElementById('discardButton').addEventListener('click', discardChanges);
document.getElementById('reloadButton').addEventListener('click', reloadNote);
document.getElementById('printButton').addEventListener('click', printNote);
document.getElementById('shareButton').addEventListener('click', shareNote);

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
    if (!menu.contains(event.target) && event.target !== menuButton) {
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
function showUserModal() {
    menu.classList.add('hidden');
    userModal.classList.remove('hidden');
    // Clear the input field when showing the modal
    document.getElementById('newUserName').value = '';
    loadExistingUsers();
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
            userModal.classList.add('hidden');
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

function selectUser(name) {
    // Release any existing note lock when switching users
    if (currentNote && currentNote.id) {
        fetch(`/api/notes/${currentNote.id}/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser })
        }).catch(error => console.error('Error releasing note lock:', error));
    }
    
    currentUser = name;
    localStorage.setItem('octonote_user', name);
    userModal.classList.add('hidden');
    loadNotes();
    showFeedback(`Welcome back, ${name}!`, 'success');
}

// Notes management
async function loadNotes() {
    try {
        const response = await fetch('/api/notes');
        const notes = await response.json();
        notesList.innerHTML = notes.map(note => `
            <div class="note-card" data-note-id="${note.id}">
                <h3>${note.title}</h3>
                <p>Last edited by ${note.lastEditedBy} on ${formatDate(note.lastEdited)}</p>
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
        showFeedback('Error loading notes', 'error');
    }
}

async function openNote(noteId) {
    try {
        const response = await fetch(`/api/notes/${noteId}`);
        if (response.status === 409) {
            const data = await response.json();
            showFeedback(`This note is being edited by ${data.user || 'another user'}`, 'warning');
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load note');
        }

        const note = await response.json();
        
        // Try to acquire the note lock
        const lockResponse = await fetch(`/api/notes/${noteId}/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser })
        });

        if (!lockResponse.ok) {
            const lockData = await lockResponse.json();
            showFeedback(`This note is being edited by ${lockData.user || 'another user'}`, 'warning');
            return;
        }

        currentNote = note;
        noteTitle.value = note.title;
        noteContent.value = note.content;
        noteMeta.textContent = `Last edited by ${note.lastEditedBy || currentUser} on ${formatDate(note.lastEdited)}`;
        
        notesList.classList.add('hidden');
        noteEditor.classList.remove('hidden');
        
        // Setup autosave
        setupAutosave();
    } catch (error) {
        showFeedback('Error opening note', 'error');
    }
}

function setupAutosave() {
    const saveDelay = 2000; // 2 seconds
    
    noteContent.addEventListener('input', () => {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(saveNote, saveDelay);
    });
}

async function saveNote() {
    if (!currentNote) return;

    try {
        const method = currentNote.id ? 'PUT' : 'POST';
        const url = currentNote.id ? `/api/notes/${currentNote.id}` : '/api/notes';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: noteTitle.value,
                content: noteContent.value,
                user: currentUser
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (!currentNote.id) {
                currentNote.id = data.id;
            }
            showFeedback('Note saved successfully', 'success');
            return data;
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save note');
        }
    } catch (error) {
        showFeedback(error.message || 'Error saving note', 'error');
        throw error;
    }
}

function discardChanges() {
    if (confirm('Are you sure you want to discard your changes?')) {
        backToList();
    }
}

function backToList() {
    if (currentNote && !currentNote.id) {
        // If it's a new note, save it before going back
        saveNote().then(() => {
            noteEditor.classList.add('hidden');
            notesList.classList.remove('hidden');
            currentNote = null;
            clearTimeout(autosaveTimeout);
            loadNotes(); // Refresh the list after saving
        }).catch(() => {
            // If save fails, stay in editor
            showFeedback('Note not saved. Please try again.', 'error');
        });
    } else {
        // Release the note lock when going back
        if (currentNote && currentNote.id) {
            fetch(`/api/notes/${currentNote.id}/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: currentUser })
            }).catch(error => console.error('Error releasing note lock:', error));
        }
        noteEditor.classList.add('hidden');
        notesList.classList.remove('hidden');
        currentNote = null;
        clearTimeout(autosaveTimeout);
    }
}

async function reloadNote() {
    if (currentNote) {
        await openNote(currentNote.id);
        showFeedback('Note reloaded', 'success');
    }
}

// Create new note
async function createNewNote() {
    if (!currentUser) {
        showFeedback('Please select a user first', 'error');
        showUserModal();
        return;
    }

    currentNote = {
        id: null,
        title: 'New Note',
        content: '',
        lastEditedBy: currentUser,
        lastEdited: new Date().toISOString()
    };

    noteTitle.value = currentNote.title;
    noteContent.value = currentNote.content;
    noteMeta.textContent = `Created by ${currentUser}`;
    
    notesList.classList.add('hidden');
    noteEditor.classList.remove('hidden');
    
    // Setup autosave
    setupAutosave();
}

// Print note
function printNote() {
    if (!currentNote) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${currentNote.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { margin-bottom: 20px; }
                    .meta { color: #666; margin-bottom: 20px; }
                    .content { white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h1>${currentNote.title}</h1>
                <div class="meta">Last edited by ${currentNote.lastEditedBy} on ${formatDate(currentNote.lastEdited)}</div>
                <div class="content">${currentNote.content}</div>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Share note
async function shareNote() {
    if (!currentNote) return;
    
    try {
        const shareData = {
            title: currentNote.title,
            text: currentNote.content,
            url: window.location.href
        };

        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // Fallback for browsers that don't support the Web Share API
            const textArea = document.createElement('textarea');
            textArea.value = `${currentNote.title}\n\n${currentNote.content}`;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showFeedback('Note content copied to clipboard', 'success');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            showFeedback('Error sharing note', 'error');
        }
    }
}

async function showStatus() {
    try {
        menu.classList.add('hidden');
        const response = await fetch('/api/status');
        const status = await response.json();
        const statusContent = document.getElementById('statusContent');
        statusContent.innerHTML = `
            <div class="status-header">
                <h2>System Status</h2>
                <button class="close-button" onclick="closeStatusModal()">×</button>
            </div>
            <div class="status-info">
                <p>Server Status: ${status.status}</p>
                <p>Uptime: ${status.uptime}</p>
                <p>Memory Usage: ${status.memory}</p>
                <p>Active Users: ${status.activeUsers}</p>
                <p>Total Notes: ${status.totalNotes}</p>
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
        
        // Use a consistent format across all devices
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}`;
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
}); 