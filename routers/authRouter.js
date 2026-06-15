const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const { requireLogin } = require('../middlewares/auth');
require('dotenv').config(); //

// Create a new user account
router.post('/signup', async (req, res) => {
    try {
      const {username, password, phoneNumber } = req.body;
  
       // Validate required fields
       if (!username || !password || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: username, password, and phoneNumber are required'
        });
      }
  
       // Check if user already exists
       const existingUser = await User.getUserByUsername(username);
       if (existingUser) {
         return res.status(409).json({
           success: false,
           error: 'Username already exists'
         });
       }
  
       // Check if phone number is already registered
      const existingPhone = await User.getUserByPhone(phoneNumber);
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          error: 'Phone number already registered'
        });
      }
  
      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create new user using Mongoose
      const newUser = await User.create({
        username,
        password: hashedPassword,
        phoneNumber,
        clientId: phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber
      });
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: newUser._id, 
          username: newUser.username 
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );

       // Return success without exposing password
      const { password: _, ...userWithoutPassword } = newUser.toObject();
  
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: userWithoutPassword,
        token
      });
  
    } catch (error) {
      console.error('Signup failed:', error.message);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create user'
      });
    }
  }); 
  
router.post('/login', async(req, res) => {
  try {
    const { username, password } = req.body;
      
    // Find user 
    const user = await User.getUserByUsername(username);
    if (!user) {
      // If no user, future TODO redirect to sign up.  
      return res.status(401).json({ success: false, error: 'Cannot find user'});
    }
  
    // If can find user with username, verify password is correct. 
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Sorry this is the wrong password'});
    } else {
      // If correct password, login and generate token 
      const token = jwt.sign(
        {
          id: user._id,
          username: user.username
        },
        process.env.JWT_SECRET, // Use env for secret 
        { expiresIn: '7d' } // Token expires in 7 days
      );
  
      // Return user information without password 
      const { password:_, ...userWithoutPassword } = user.toObject();
      return res.json({ 
        success: true, 
        user: userWithoutPassword, 
        token
      });
    }
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}); 
  
// Logout route 
router.get('/logout', requireLogin, (req, res) => {
  // Get the token from the Authorization header 
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(400).json({
      success: false, 
      message: 'No token provided'
    });
  }
  
  // Frontend will do the logging out of forgetting the token in the cache. 

  // Later on I would invalidate the token, but now we're just confirming the user is authed
  res.json({
    success: true, 
    message: 'Logout successful',
    username: req.username // Get this from requireLogin middleware 
  })
}); 
  
module.exports = router; 
