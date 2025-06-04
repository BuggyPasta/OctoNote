const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = '/data/octonote/users.txt';

// Helper function to read users file
async function readUsers() {
    try {
        const content = await fs.readFile(USERS_FILE, 'utf8');
        return content.split('\n').filter(Boolean);
    } catch (error) {
        console.error('Error reading users file:', error);
        if (error.code === 'ENOENT') {
            // If file doesn't exist, create it
            try {
                await fs.writeFile(USERS_FILE, '', 'utf8');
                console.log('Created new users.txt file');
                return [];
            } catch (writeError) {
                console.error('Error creating users file:', writeError);
                throw new Error('Could not create users file. Please check permissions.');
            }
        }
        throw error; // Re-throw other errors
    }
}

// Helper function to write users file
async function writeUsers(users) {
    try {
        // First check if we can write to the file
        try {
            await fs.access(USERS_FILE, fs.constants.W_OK);
        } catch (error) {
            console.error('No write permission for users file:', error);
            throw new Error('No permission to write to users file');
        }

        // Write the file
        await fs.writeFile(USERS_FILE, users.join('\n') + '\n', 'utf8');
    } catch (error) {
        console.error('Error writing users file:', error);
        throw error; // Re-throw to be handled by the route
    }
}

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await readUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error reading users' });
    }
});

// Create a new user
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Sanitize and validate name
        const sanitizedName = name.trim();
        if (sanitizedName.length < 2 || sanitizedName.length > 50) {
            return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
        }

        // Check for invalid characters
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitizedName)) {
            return res.status(400).json({ error: 'Name contains invalid characters' });
        }

        const users = await readUsers();
        
        // Check if name already exists (case-insensitive)
        if (users.some(user => user.toLowerCase() === sanitizedName.toLowerCase())) {
            return res.status(409).json({ error: 'This name is already taken, please choose a different one.' });
        }

        users.push(sanitizedName);
        await writeUsers(users);
        res.status(201).json({ name: sanitizedName });
    } catch (error) {
        console.error('Error creating user:', error);
        // Check if it's a permission error
        if (error.code === 'EACCES') {
            return res.status(500).json({ error: 'Permission denied when creating user. Please check directory permissions.' });
        }
        // Check if it's a file system error
        if (error.code === 'ENOENT') {
            return res.status(500).json({ error: 'Users file not found. Please check if the data directory exists.' });
        }
        res.status(500).json({ error: `Error creating user: ${error.message}` });
    }
});

// Delete a user
router.delete('/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const users = await readUsers();
        const filteredUsers = users.filter(user => user !== name);
        
        if (filteredUsers.length === users.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        await writeUsers(filteredUsers);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting user' });
    }
});

module.exports = router; 