const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createLogger, format, transports } = require('winston');
const fs = require('fs').promises;

// Import routes
const notesRouter = require('./routes/notes');
const usersRouter = require('./routes/users');
const statusRouter = require('./routes/status');

// Initialize Express app
const app = express();
const port = 51828;

// Initialize data directory
async function initializeDataDirectory() {
  try {
    await fs.mkdir('/data/octonote/notes', { recursive: true });
    await fs.mkdir('/data/octonote/logs', { recursive: true });
    
    // Create users.txt if it doesn't exist
    try {
      await fs.access('/data/octonote/users.txt');
    } catch {
      await fs.writeFile('/data/octonote/users.txt', '', 'utf8');
    }
  } catch (error) {
    console.error('Error initializing data directory:', error);
    process.exit(1);
  }
}

// Configure Winston logger
let logger;
async function initializeLogger() {
  logger = createLogger({
    format: format.combine(
      format.timestamp(),
      format.json()
    ),
    transports: [
      new transports.File({ 
        filename: '/data/octonote/logs/error.log', 
        level: 'error' 
      }),
      new transports.File({ 
        filename: '/data/octonote/logs/combined.log' 
      })
    ]
  });

  // Add console transport in development
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
      format: format.simple()
    }));
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "http:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "http:", "https:"],
      scriptSrc: ["'self'", "http:", "https:"],
      imgSrc: ["'self'", "data:", "http:", "https:"],
      connectSrc: ["'self'", "http:", "https:"],
      upgradeInsecureRequests: null
    }
  }
}));

// Redirect HTTPS to HTTP
app.use((req, res, next) => {
  if (req.secure) {
    res.redirect(`http://${req.headers.host}${req.url}`);
  } else {
    next();
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/notes', notesRouter);
app.use('/api/users', usersRouter);
app.use('/api/status', statusRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  if (logger) {
    logger.error(err.stack);
  } else {
    console.error(err.stack);
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
async function startServer() {
  await initializeDataDirectory();
  await initializeLogger();
  
  // Add logging middleware after logger is initialized
  app.use(morgan('combined', {
    stream: {
      write: message => logger.info(message.trim())
    }
  }));

  app.listen(port, () => {
    logger.info(`OctoNote server listening on port ${port}`);
  });
}

startServer(); 