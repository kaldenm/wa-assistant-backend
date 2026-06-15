const jwt = require('jsonwebtoken');

// Middleware for determining if the user is logged into their account
async function requireLogin(req, res, next) {
  // Get token frmo Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Reject requests without a token 
  if (!token) {
    return res.status(401).json({
      success: false, 
      error: 'No token provided. Authorization denied.'
    });
  }

  try {
    // Verify token using the secret key. 
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add the username from the token to the request
    // This allows downstream routes to know which user is making the request. - Active session! 
    req.username = decoded.username; 

    // Call next to continue to the next route handler 
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(403).json({
      success: false, 
      message: 'Invalid token. Authorization denied.'
    });
  }
}

  module.exports = { requireLogin }; 

  
