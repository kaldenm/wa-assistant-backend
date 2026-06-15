const Agenda = require('agenda');
const { AgendaError } = require('../errorClasses');
const { summarizeMessagesAndSendToUser } = require('../services/whatsappAssistant');
let User;

// Create a single instance of Agenda that will be shared
const agenda = new Agenda({
  db: {
    address: process.env.MONGODB_URI,
    collection: 'whatsappJobs'
  }
});

// Define the WhatsApp check job
agenda.define('check-all-whatsapp-clients', async job => {
  User = require('../models/user');
  const whatsappManager = require('./whatsapp');
  const now = new Date();
  console.log('Running WhatsApp check for all clients', 
    '\nUTC:', now.toISOString(),
    '\nLocal:', now.toLocaleString('en-US', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateStyle: 'full',
      timeStyle: 'long'
    })
  );
  
  try {
    // Get all active Users from the DB
    const activeUsers = await User.find({ isActive: true });
    console.log(`Processing ${activeUsers.length} active users`);
    
    // Process each active user
    const results = [];
    for (const user of activeUsers) {
      try {
        const { authenticated, client } = await whatsappManager.getOrInitializeClient(user.phoneNumber);
        
        // Handle unauthenticated users
        if (!authenticated) {
          results.push({ username: user.username, success: false, reason: 'Not authenticated' });
          await cleanupClient(whatsappManager, client);
          continue;
        }

        // Process authenticated users
        const result = await summarizeMessagesAndSendToUser(user.phoneNumber);
        results.push({ username: user.username, success: true, result });
      } catch (error) {
        results.push({ username: user.username, success: false, error: error.message });
        await cleanupClient(whatsappManager, client);
      }
    }

    // Log overall job results
    console.log(`Processed ${results.length} users (Success: ${results.filter(r => r.success).length})`);
    return results;
  } catch (error) {
    await job.fail(new AgendaError(`Unexpected agenda error: ${error.message}`));
  }
});

// Helper function to clean up WhatsApp clients
async function cleanupClient(whatsappManager, client) {
  try {
    // Remove all listeners
    ['qr', 'ready', 'auth-failure', 'disconnected', 'message'].forEach(event => {
        client.removeAllListeners(event);
    });

    await client.destroy();

    const clientId = whatsappManager.formatPhoneNumber(client.phoneNumber);
    whatsappManager.clients.delete(clientId);

  } catch (error) {
    console.error(`Error cleaning up client: ${error.message}`);
  }
}

// agenda.every('5 hours', 'check-all-whatsapp-clients');

// Export the agenda instance and helper functions
module.exports = {
  agenda
};