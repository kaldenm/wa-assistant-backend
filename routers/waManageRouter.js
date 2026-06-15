const express = require('express') ;
const router = express.Router();
const { requireLogin } = require('../middlewares/auth');
const User = require('../models/user');
const whatsappManager = require('../services/whatsappClientManager');

// Get qr code for whatsapp authentication 
// Returns qr code if auth is needed, or success message is already authed
router.get('/qr', requireLogin, async (req, res) => {
  try {
    // Get user
    const user = await User.getUserByUsername(req.username);
    const phoneNumber = user.phoneNumber;
   
    // Attempt to get/create client 
    const { qr, authenticated } = await whatsappManager.getLoginQR(phoneNumber);

    console.log(`QR route response: authenticated=${authenticated}, hasQr=${Boolean(qr)}`);
    
    // Case 1: Client exists and is authenticated
    if (authenticated) {
      return res.json({ 
        success: true, 
        authenticated: true,
        message: 'Already authenticated' 
      });
    } else if (qr) {
      // Case 2: New QR code generated and returned to the frontend.
      console.log('QR code generated for frontend delivery');
      
      return res.json({ 
        success: true, 
        authenticated: false,
        qr: qr,
        message: 'QR code generated successfully' 
      });
    } else {
      // Case 3: Failed to generate QR 
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to generate WhatsApp QR code for authentication' 
      });
    }
  } catch (error) {
    console.error('Unexpected error in QR code route:', error.message);

   
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get authentication status of user's whatsappclient 
router.get('/auth-status', requireLogin, async (req, res) => {
  try {
    // Get user 
    const user = await User.getUserByUsername(req.username);

    // Check if the user exists 
    if (!user) {
      return res.status(404).json({
        success: false, 
        error: "User not found"
      });
    }

    // Check if user has a phone numebr
    if (!user.phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "User has no phone number configured"
      });
    }

    const phoneNumber = user.phoneNumber;
  
    // Check authentication state for this phone number
    const status = await whatsappManager.checkClientStatus(phoneNumber);
    
    res.json({ 
      success: true, 
      status: status.authenticated ? 'connected' : 'disconnected',
      requiresQR: status.requiresQR, 
      error: status.error, 
      phoneNumber: phoneNumber 
    });
  } catch (error) {
    console.error('Error checking authentication status:', error.message);

    res.status(500).json({ 
      success: false, 
      error: error.message,
    });
  }
});

// Logout of the whatsappclient session. 
// Cleans up the client sessions and its methods 
router.post('/disconnectWAclient', requireLogin, async (req, res) => {
    try {
      // Get user 
      const user = await User.getUserByUsername(req.username);
      const phoneNumber = user.phoneNumber;
  
      // Attempt to get/initialize client
      const { authenticated, requiresQR, error } = await whatsappManager.getOrInitializeClient(phoneNumber);
      
      // Case 1: Client isn't authenticated, nothing to logout from. 
      if (!authenticated) {
        return res.status(400).json({ 
          success: false, 
          error: error,
          requiresQR: requiresQR
        });
      }

      // Case 2: Client is authenticated. Get client info for logging out. 
      const result = await whatsappManager.logout(phoneNumber);

       // Clean up session data using exec (built into Node)
       const { exec } = require('child_process');
       const clientId = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
       
       // Delete the session folder using simple shell command
       exec(`rm -rf ./sessions/${clientId}`, (err, stdout, stderr) => {
         if (err) {
           console.error(`Error deleting session: ${err.message}`);
         } else {
           console.log('Successfully deleted WhatsApp session data');
         }
       });
        
      res.json({ 
        success: result, 
        message: result ? 'Logged out successfully' : 'Failed to logout'
      });
    } catch (error) {
      console.error('Error logging out:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

module.exports = router; 
