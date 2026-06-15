// Environment config
require('dotenv').config();
const PORT = process.env.PORT || 5000;

// Core imports
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io'); 
const cors = require('cors'); 
const morgan = require('morgan');
const mongoose = require('mongoose');

// Import modules 
const eventEmitter = require('./events');
const initializeSocketHandlers = require('./socket-handlers.js');
const { agenda } = require('./scheduler/agenda');

// Import route modules 
const authRouter = require('./routers/authRouter.js');
const waManageRouter = require('./routers/waManageRouter.js');
const waMessageRouter = require('./routers/waMessageRouter.js');

// Express setup
const app = express(); 
const server = createServer(app);

// CORS middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
  'https://waassistant-frontend.onrender.com' : 'http://localhost:3000', // Allow any origin in production for now
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Global middleware
app.use(express.json());
app.use(morgan('dev')); 

// Root route handler 
app.get('/', (req, res) => {
  console.log(`Root route accessed: ${req.method} ${req.path}`);
  
  res.status(200).json({
    status: 'success',
    message: 'WhatsApp Assistant API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      whatsappManager: '/whatsappManager',
      whatsappMessage: '/whatsappMessage'
    }
  });
});

// Initialize socket io 
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:3000',
    methods: ["GET", "POST"]
  }
}); 

// Set up socket handlers and get notification utilities
const socketHandlers = initializeSocketHandlers(io);

// Mount routes directly
app.use('/auth', authRouter);
app.use('/whatsappManager', waManageRouter);
app.use('/whatsappMessage', waMessageRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Request failed:', err.message);
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    status: 'error',
    message
  });
});

// Catch-all route for debugging
app.use('*', (req, res) => {
  console.log(`Catch-all route accessed: ${req.method} ${req.path}`);
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path
  });
});

// Start the application with promises - Mongo connect, initialize job scheduler, start http server
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('✅ MongoDB initialized');
  return agenda.start();
})
.then(() => {
  // Start the server
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
})
.catch(error => {
  console.error(`Failed to start the server. Check required environment variables. Error type: ${error.name}`);
  process.exit(1);
});

// Export the notification utility
module.exports = { 
  // ...socketHandlers,
  io 
};
