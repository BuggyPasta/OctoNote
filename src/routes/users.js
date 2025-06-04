const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = '/data/octonote/users.txt';

// Helper function to read users
async function readUsers() {
    try {
        const content = await fs.readFile(USERS_FILE, 'utf8');
        const users = content.split('\n').filter(user => user.trim());
        console.log('Read users:', users);
        return users;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Users file does not exist, creating empty file');
            await fs.writeFile(USERS_FILE, '', 'utf8');
            return [];
        }
        console.error('Error reading users:', error);
        throw error;
    }
}

// Helper function to write users
async function writeUsers(users) {
    try {
        console.log('Writing users:', users);
        await fs.writeFile(USERS_FILE, users.join('\n'), 'utf8');
        console.log('Users written successfully');
    } catch (error) {
        console.error('Error writing users:', error);
        throw error;
    }
}

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await readUsers();
        console.log('Returning users:', users);
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
        console.log('Creating user:', name);
        
        if (!name) {
            console.log('Name is required');
            return res.status(400).json({ error: 'Name is required' });
        }

        const users = await readUsers();
        if (users.includes(name)) {
            console.log('User already exists:', name);
            return res.status(400).json({ error: 'User already exists' });
        }

        users.push(name);
        await writeUsers(users);
        console.log('User created successfully:', name);
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
        console.log('Deleting user:', name);
        
        const users = await readUsers();
        const filteredUsers = users.filter(user => user !== name);
        
        if (filteredUsers.length === users.length) {
            console.log('User not found:', name);
            return res.status(404).json({ error: 'User not found' });
        }

        await writeUsers(filteredUsers);
        console.log('User deleted successfully:', name);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
});

module.exports = router; 