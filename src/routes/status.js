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
        const files = await fs.readdir(NOTES_DIR);
        const totalNotes = files.filter(file => file.endsWith('.txt')).length;

        // Get total users
        const users = await fs.readFile(USERS_FILE, 'utf8');
        const totalUsers = users.split('\n').filter(Boolean).length;

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
        res.status(500).json({
            status: 'error',
            error: 'Error getting system status'
        });
    }
});

module.exports = router; 