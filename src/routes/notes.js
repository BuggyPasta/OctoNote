const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const sanitizeFilename = require('sanitize-filename');
const { v4: uuidv4 } = require('uuid');

const NOTES_DIR = '/data/octonote/notes';
const noteLocks = new Map();

// Helper function to read a note file
async function readNoteFile(noteId) {
    try {
        const filePath = path.join(NOTES_DIR, `${noteId}.txt`);
        const content = await fs.readFile(filePath, 'utf8');
        const [title, meta, ...contentLines] = content.split('\n');
        return {
            id: noteId,
            title: title.replace('Title: ', ''),
            lastEditedBy: meta.split(' by ')[1].split(' on ')[0],
            lastEdited: meta.split(' on ')[1],
            content: contentLines.join('\n')
        };
    } catch (error) {
        console.error(`Error reading note file ${noteId}:`, error);
        throw error;
    }
}

// Helper function to write a note file
async function writeNoteFile(noteId, title, content, user) {
    try {
        const filePath = path.join(NOTES_DIR, `${noteId}.txt`);
        const now = new Date().toLocaleString('en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        const fileContent = `Title: ${title}\nLast edited by ${user} on ${now}\n${content}`;
        await fs.writeFile(filePath, fileContent, 'utf8');
    } catch (error) {
        console.error(`Error writing note file ${noteId}:`, error);
        throw error;
    }
}

// Get all notes
router.get('/', async (req, res) => {
    try {
        const files = await fs.readdir(NOTES_DIR);
        const notes = await Promise.all(
            files
                .filter(file => file.endsWith('.txt'))
                .map(async file => {
                    const noteId = path.basename(file, '.txt');
                    return readNoteFile(noteId);
                })
        );
        res.json(notes);
    } catch (error) {
        console.error('Error reading notes:', error);
        res.status(500).json({ error: 'Error reading notes' });
    }
});

// Get a specific note
router.get('/:id', async (req, res) => {
    try {
        const noteId = sanitizeFilename(req.params.id);
        const filePath = path.join(NOTES_DIR, `${noteId}.txt`);

        // Check if note is locked
        if (noteLocks.has(noteId)) {
            return res.status(409).json({
                error: 'Note is locked',
                user: noteLocks.get(noteId)
            });
        }

        // Lock the note
        noteLocks.set(noteId, req.query.user);

        // Read and return the note
        const note = await readNoteFile(noteId);
        res.json(note);
    } catch (error) {
        console.error(`Error reading note ${req.params.id}:`, error);
        res.status(404).json({ error: 'Note not found' });
    }
});

// Create a new note
router.post('/', async (req, res) => {
    try {
        const { title, content, user } = req.body;
        if (!title || !content || !user) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const noteId = uuidv4();
        await writeNoteFile(noteId, title, content, user);
        res.status(201).json({ id: noteId });
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Error creating note' });
    }
});

// Update a note
router.put('/:id', async (req, res) => {
    try {
        const noteId = sanitizeFilename(req.params.id);
        const { title, content, user } = req.body;

        if (!title || !content || !user) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if note is locked by another user
        if (noteLocks.has(noteId) && noteLocks.get(noteId) !== user) {
            return res.status(409).json({
                error: 'Note is locked',
                user: noteLocks.get(noteId)
            });
        }

        await writeNoteFile(noteId, title, content, user);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error updating note ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error updating note' });
    }
});

// Delete a note
router.delete('/:id', async (req, res) => {
    try {
        const noteId = sanitizeFilename(req.params.id);
        const filePath = path.join(NOTES_DIR, `${noteId}.txt`);

        // Check if note is locked
        if (noteLocks.has(noteId)) {
            return res.status(409).json({
                error: 'Note is locked',
                user: noteLocks.get(noteId)
            });
        }

        await fs.unlink(filePath);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting note ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error deleting note' });
    }
});

// Release note lock
router.post('/:id/release', (req, res) => {
    const noteId = sanitizeFilename(req.params.id);
    noteLocks.delete(noteId);
    res.json({ success: true });
});

// Lock a note
router.post('/:id/lock', async (req, res) => {
    try {
        const noteId = sanitizeFilename(req.params.id);
        const { user } = req.body;

        if (!user) {
            return res.status(400).json({ error: 'User is required' });
        }

        // Check if note is already locked
        if (noteLocks.has(noteId)) {
            return res.status(409).json({
                error: 'Note is locked',
                user: noteLocks.get(noteId)
            });
        }

        // Check if note exists
        try {
            await fs.access(path.join(NOTES_DIR, `${noteId}.txt`));
        } catch (error) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Lock the note
        noteLocks.set(noteId, user);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error locking note ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error locking note' });
    }
});

// Unlock a note
router.post('/:id/unlock', async (req, res) => {
    try {
        const noteId = sanitizeFilename(req.params.id);
        const { user } = req.body;

        if (!user) {
            return res.status(400).json({ error: 'User is required' });
        }

        // Check if note is locked by this user
        if (noteLocks.has(noteId) && noteLocks.get(noteId) !== user) {
            return res.status(403).json({
                error: 'Note is locked by another user',
                user: noteLocks.get(noteId)
            });
        }

        // Remove the lock
        noteLocks.delete(noteId);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error unlocking note ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error unlocking note' });
    }
});

// Get note lock status
router.get('/:id/lock', async (req, res) => {
    try {
        const noteId = sanitizeFilename(req.params.id);
        
        if (noteLocks.has(noteId)) {
            res.json({
                locked: true,
                user: noteLocks.get(noteId)
            });
        } else {
            res.json({
                locked: false
            });
        }
    } catch (error) {
        console.error(`Error getting lock status for note ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error getting lock status' });
    }
});

module.exports = router; 