const express = require('express');
const router = express.Router();
const whatsappManager = require('../services/whatsappClientManager');
const { requireLogin } = require('../middlewares/auth');
const User = require('../models/user');

// Get the last 10 messages from the last 5 chats. 
router.get('/last10messages/:phoneNumber', requireLogin, async (req, res) => {  
    try {
      // Get user 
      const user = await User.getUserByUsername(req.username);
      const phoneNumber = user.phoneNumber;
  
      // Try to get or initialize the client
      const { authenticated, requiresQR, error } = await whatsappManager.getOrInitializeClient(phoneNumber);
      
      if (!authenticated) {
        return res.status(400).json({ 
          success: false, 
          error: error,
          requiresQR: requiresQR
        });
      }
      
      // If client is authenticated, get messages. 
      const messages = await whatsappManager.getlast10Messageoflast5Chats(phoneNumber);
      
      res.json({
        success: true, 
        messages: messages
      });
    } catch (error) {
      console.error('Error retrieving messages:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  

  // Sends message to a client. Sender (user) must be authenticated. Needs a message to go through. 
  router.post('/send-message', requireLogin, async (req, res) => {
     // Get user 
     const user = await User.getUserByUsername(req.username);
     const phoneNumber = user.phoneNumber;
     
    // Only need message content from the request body
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message content is required' 
      });
    }
  
    try {
      // Try to get or initialize the sender client
      const { authenticated, requiresQR, error } = await whatsappManager.getOrInitializeClient(phoneNumber);
      
      if (!authenticated) {
        return res.status(400).json({ 
          success: false, 
          error: error,
          requiresQR: requiresQR
        });
      }
      
       // Send message to user's own chat (self-message)
      const result = await whatsappManager.sendMessage(
        phoneNumber, // Sender's phone number
        phoneNumber, // Recipient's phone number (same as sender)
        message
      );
      
      res.json({ 
        success: true, 
        message: 'Message sent successfully'
      });
    } catch (error) {
      console.error('Error sending message:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

module.exports = router; 
  
