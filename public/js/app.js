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

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);
menuButton.addEventListener('click', toggleMenu);
document.getElementById('newNoteButton').addEventListener('click', createNewNote);
document.getElementById('statusButton').addEventListener('click', showStatus);
document.getElementById('userSwitchButton').addEventListener('click', showUserModal);

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

// Menu toggle
function toggleMenu() {
    menu.classList.toggle('hidden');
}

// User management
function showUserModal() {
    userModal.classList.remove('hidden');
    loadExistingUsers();
}

async function loadExistingUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const existingUsers = document.getElementById('existingUsers');
        existingUsers.innerHTML = users.map(user => `
            <button onclick="selectUser('${user}')">
                ${user}
            </button>
        `).join('');
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
            <div class="note-card" onclick="openNote('${note.id}')">
                <h3>${note.title}</h3>
                <p>Last edited by ${note.lastEditedBy} on ${formatDate(note.lastEdited)}</p>
            </div>
        `).join('');
    } catch (error) {
        showFeedback('Error loading notes', 'error');
    }
}

async function openNote(noteId) {
    try {
        const response = await fetch(`/api/notes/${noteId}`);
        if (response.status === 409) {
            const data = await response.json();
            showFeedback(`This note is being edited by ${data.user}`, 'warning');
            return;
        }

        const note = await response.json();
        currentNote = note;
        noteTitle.value = note.title;
        noteContent.value = note.content;
        noteMeta.textContent = `Last edited by ${note.lastEditedBy} on ${formatDate(note.lastEdited)}`;
        
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
        const response = await fetch(`/api/notes/${currentNote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: noteTitle.value,
                content: noteContent.value,
                user: currentUser
            })
        });

        if (response.ok) {
            showFeedback('Note saved successfully', 'success');
            loadNotes(); // Refresh the list
        } else {
            const data = await response.json();
            showFeedback(data.error, 'error');
        }
    } catch (error) {
        showFeedback('Error saving note', 'error');
    }
}

function discardChanges() {
    if (confirm('Are you sure you want to discard your changes?')) {
        backToList();
    }
}

function backToList() {
    noteEditor.classList.add('hidden');
    notesList.classList.remove('hidden');
    currentNote = null;
    clearTimeout(autosaveTimeout);
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
        const response = await fetch('/api/status');
        const status = await response.json();
        const statusContent = document.getElementById('statusContent');
        statusContent.innerHTML = `
            <p>Server Status: ${status.status}</p>
            <p>Uptime: ${status.uptime}</p>
            <p>Memory Usage: ${status.memory}</p>
            <p>Active Users: ${status.activeUsers}</p>
            <p>Total Notes: ${status.totalNotes}</p>
        `;
        statusModal.classList.remove('hidden');
    } catch (error) {
        showFeedback('Error loading status', 'error');
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
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