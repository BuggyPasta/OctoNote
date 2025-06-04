const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = '/data/octonote/users.txt';

// Helper function to read users
async function readUsers() {
    try {
        const content = await fs.readFile(USERS_FILE, 'utf8');
        return content.split('\n').filter(user => user.trim());
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
}

// Helper function to write users
async function writeUsers(users) {
    try {
        await fs.writeFile(USERS_FILE, users.join('\n'), 'utf8');
    } catch (error) {
        console.error('Error writing users:', error);
        throw error;
    }
}

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await readUsers();
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Error getting users' });
    }
});

// Create a new user
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const users = await readUsers();
        if (users.includes(name)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        users.push(name);
        await writeUsers(users);
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
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