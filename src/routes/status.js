const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const NOTES_DIR = '/data/octonote/notes';
const USERS_FILE = '/data/octonote/users.txt';

// Get system status
router.get('/', async (req, res) => {
    try {
        // Get total notes
        let totalNotes = 0;
        try {
            const files = await fs.readdir(NOTES_DIR);
            totalNotes = files.filter(file => file.endsWith('.txt')).length;
        } catch (error) {
            console.error('Error reading notes directory:', error);
            // Continue with 0 notes if directory doesn't exist
        }

        // Get total users
        let totalUsers = 0;
        try {
            const users = await fs.readFile(USERS_FILE, 'utf8');
            totalUsers = users.split('\n').filter(Boolean).length;
        } catch (error) {
            console.error('Error reading users file:', error);
            // Continue with 0 users if file doesn't exist
        }

        // Get memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = `${Math.round(usedMem / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB`;

        // Get uptime
        const uptime = os.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const formattedUptime = `${days}d ${hours}h ${minutes}m`;

        res.json({
            status: 'healthy',
            uptime: formattedUptime,
            memory: memoryUsage,
            activeUsers: totalUsers,
            totalNotes: totalNotes,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting system status:', error);
        res.status(500).json({
            status: 'error',
            error: 'Error getting system status'
        });
    }
});

module.exports = router; 