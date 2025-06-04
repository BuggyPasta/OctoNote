const express = require('express');
const path = require('path');
const morgan = require('morgan');
const { createLogger, format, transports } = require('winston');
const fs = require('fs').promises;

// Import routes
const notesRouter = require('./routes/notes');
const usersRouter = require('./routes/users');
const statusRouter = require('./routes/status');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 51828;

// Middleware
app.use(express.json());

// Detailed logging for static file requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Request headers:', req.headers);
    next();
});

// Serve static files with detailed logging
const publicPath = path.join(__dirname, '../public');
console.log('Serving static files from:', publicPath);

app.use(express.static(publicPath, {
    setHeaders: (res, filePath) => {
        console.log('Serving static file:', filePath);
        if (filePath.endsWith('.css')) {
            console.log('Setting CSS content type for:', filePath);
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Response status: ${res.statusCode}`);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Routes
app.use('/api/users', usersRouter);
app.use('/api/notes', notesRouter);
app.use('/api/status', statusRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
async function startServer() {
    try {
        // Ensure data directory exists
        const dataDir = '/data/octonote';
        const notesDir = path.join(dataDir, 'notes');
        const usersFile = path.join(dataDir, 'users.txt');

        // Log directory structure
        console.log('Current working directory:', process.cwd());
        console.log('Directory contents:', await fs.readdir(process.cwd()));
        console.log('Public directory contents:', await fs.readdir(publicPath));

        try {
            await fs.access(dataDir);
            console.log('Data directory exists');
        } catch (error) {
            console.log('Creating data directory...');
            await fs.mkdir(dataDir, { recursive: true });
            console.log('Data directory created');
        }

        try {
            await fs.access(notesDir);
            console.log('Notes directory exists');
        } catch (error) {
            console.log('Creating notes directory...');
            await fs.mkdir(notesDir, { recursive: true });
            console.log('Notes directory created');
        }

        try {
            await fs.access(usersFile);
            console.log('Users file exists');
        } catch (error) {
            console.log('Creating users file...');
            await fs.writeFile(usersFile, '', 'utf8');
            console.log('Users file created');
        }

        // Verify permissions
        try {
            await fs.access(dataDir, fs.constants.R_OK | fs.constants.W_OK);
            console.log('Data directory permissions verified');
        } catch (error) {
            console.error('Permission error:', error);
            throw new Error('No permission to access data directory');
        }

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log('Server startup complete');
        });
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

startServer(); 