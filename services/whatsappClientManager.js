const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { WhatsAppError } = require('../errorClasses')
const eventEmitter = require('../events'); 

/**
 * WhatsApp Client Manager
 * Manages the lifecycle of WhatsApp Web clients using a headless browser.
 * Handles WhatsApp connection, QR code generation, and message sending.
 */

const whatsappManager = {
/** Client state management:
* The 'clients' Map stores WhatsApp sessions keyed by clientId (formatted phone number)
* Each entry contains: 
* {
*   client: whatsapp-web.js Client instance (controls browser session),
*   sessionDir: path to stored auth data for persistence,
*   authenticated: boolean flag indicating successful WhatsApp connection,
*   scanningTimeoutId: timeout ID for QR scan expiration (cleared on auth),
*   generationTimeoutId: timeout ID for QR generation process
* }
* Clients are added to the Map when QR generation begins or session restoration starts.
* Note: Authentication is tracked independantly of Map inclusion. 
* Clients are removed from the Map on timeouts, logout, authentication failures, or disconnection events.*/
clients: new Map(),
  
// Initialize WhatsApp Manager
initialize: function() {
  console.log('WhatsApp Manager initialized (using whatsapp-web.js)');
  return this;
},

formatPhoneNumber: function(phoneNumber) {
  // Remove any '+' prefix if present to create clientId for internal use 
  return phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
},
  
// Check client status without initalizing client. Return client's status info as object. 
checkClientStatus: function(phoneNumber) {
  const clientId = this.formatPhoneNumber(phoneNumber);
    
  // If client already exists, return its status
  if (this.clients.has(clientId)) {
    const clientInfo = this.clients.get(clientId);
    return {
      authenticated: clientInfo.authenticated,
      requiresQR: !clientInfo.authenticated,
      error: null
    };
  }
    
  // If client doesn't exist, needs QR
  return {
    authenticated: false,
     requiresQR: true,
     error: null
  };
},

  /**
  getLoginQR servers 2 flows
    1. Generate a new QR for first time authentication
    2. Attempt to restore an exsiting session if previously authenticated

   * QR Generation Process:
   * 1. Create new WhatsApp Web client instance
   * 2. Set up timeouts for both generation (50s) and scanning (120s)
   * 3. Wait for 'qr' event (success) or timeout (failure)
   * 4. Clean up resources if timeouts occur
   * 5. Update authentication status on successful connection
   * Returns: Promise {qr: string, clientId: string, authenticated: boolean}
   */
  getLoginQR: async function(phoneNumber) {
    const clientId = this.formatPhoneNumber(phoneNumber);
    
    // Check if client already exists and is authenticated 
    if (this.clients.has(clientId) && this.clients.get(clientId).authenticated) {
      // If yes, don't generate qr, just confirm status
      return { qr: null, clientId, authenticated: true };
    }

    // Set up session directory for new client
    const sessionDir = path.join('./sessions', clientId);
    
    // Create a new client
    const client = new Client({
      authStrategy: new LocalAuth({
          // Store session data and auth to reuse between restarts 
          dataPath: path.resolve(sessionDir),
          // Pass our internal clientId to whatsapp-web.js as its storage identifier
          clientId: clientId,
      }),
      restartOnAuthFail: true,
      puppeteer: {
          headless: 'new',
          executablePath: process.env.CHROME_PATH || undefined, 
          bypassCSPL: true,
          timeout: 180000,
          args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--window-size=1920,1080',
              '--js-flags=--max_old_space_size=4096', 
          ]
      },
      mediaOptions: {
          disableMedia: true,
          ffmpegPath: null,
          downloadMedia: false
      }
  });
  
  // Create a promise to get the QR code
  const qrPromise = new Promise((resolve, reject) => {
    // Start a timeout for QR generation
    const generationTimeout = setTimeout(() => {
      console.error('QR generation timed out');
      eventEmitter.emit('qr-generation-failed', clientId);

      // Complete cleanup if qr generation times out: 
      // First check if client still exists in the map
      // Then perform shutdown of all resources 
      try {
        if (this.clients.has(clientId)) {
          const clientInfo = this.clients.get(clientId);
          if (clientInfo && clientInfo.client) {
            // Remove all event listeners (avoids all callbacks being run after cleanup)
            ['qr', 'ready', 'auth-failure', 'disconnected', 'message'].forEach(event => {
              clientInfo.client.removeAllListeners(event);
            });
              
            // Destroy client (the pupeteer broswer instance)
            clientInfo.client.destroy().catch(err => console.error(`Error destroying client: ${err.message}`));
              
            // Remove client from map - no more actions can be done with the client 
            this.clients.delete(clientId);
            }
          }
        } catch (error) {
          console.error(`Error cleaning up after generation timeout: ${error.message}`);
        }

        // If timeout is triggered:
        reject(new WhatsAppError('QR code generation timed out'));
      }, 50000); 

      let hasResolved = false; 
      
      // QR code event when you get the QR generated 
      client.on('qr', (qr) => {
        if (!hasResolved) {
          console.log('QR code generated');

          // Mark in client that the promise of the QR generate is resolved upon getting first QR 
          hasResolved = true; 
          clearTimeout(generationTimeout);

          // Set authenticated to false bc QR needs to be scanend 
          resolve({ qr, clientId, authenticated: false });
          console.log('Generation of QR promise resolved');
        }
        // The 'qr' event may fire multiple times as WhatsApp Web periodically refreshes QR codes
        // The hasResolved flag acts as a one-way switch:
        // - First 'qr' event: process it and resolve the promise with this initial QR code
        // - Any subsequent 'qr' events: silently ignore them to prevent resolving the same promise multiple times
        // This ensures we only handle the first QR code and maintain a consistent user experience  
      });

      // If no QR was needed, client is already authenticated and ready SESSION WAS RESTORED 
      client.on('ready', () => {
        clearTimeout(generationTimeout);
        resolve({ qr: null, clientId, authenticated: true });
      });

      // Authenticateion failured 
      client.on('auth_failure', (error) => {
        clearTimeout(generationTimeout);
        reject(new WhatsAppError(`Authentication failed: ${error}`));
      });
    });

    // Store client information 
    this.clients.set(clientId, {
      client,
      sessionDir,
      authenticated: false
    });

    // QR scanning timeout 
    client.on('qr', (qr) => {
      // Only set timeout for QR code once it appears 
      if (this.clients.has(clientId)) {
        const clientInfo = this.clients.get(clientId);
        // Cleary any existing timeout
        if (clientInfo.generationTimeoutTimeoutId) {
          clearTimeout(clientInfo.generationTimeoutimeoutId); 
        }

         // Only set timeout if we haven't set one before
         if (!clientInfo.scanningTimeoutId) {
          console.log('Setting initial QR scanning timeout');

        // Set new timeout 
        clientInfo.scanningTimeoutId = setTimeout(() => {
          console.log('QR scanning timeout triggered');
          // If client still exists but isnt authenticated in time: 
          if (this.clients.has(clientId) && !this.clients.get(clientId).authenticated) {
            // Emit to frontend that scanning window is timed out
            eventEmitter.emit('qr-scan-expired', clientId);
            console.log('Emitted qr-scan-expired event')

            // Clean up functions 
            try {
              const client = this.clients.get(clientId).client;

              // Remove all listeners
              ['qr', 'ready', 'auth-failure', 'disconnected', 'message'].forEach(event => {
                client.removeAllListeners(event);
              });

              // Destroy client
              client.destroy().catch(err => console.error(`Error destroying client: ${err.message}`));

              // Remove from the client map
              this.clients.delete(clientId);

              console.log('Cleaned up expired QR session');
            } catch (error) {
              console.error(`Error cleaning up QR session: ${error.message}`);
            }
          }
        }, 120000); 
      }
    }
  }); 
    // Event: Client state changes to authentiated from succeessful scanning
    client.on('ready', () => {
      console.log('WhatsApp connection established');
      const clientInfo = this.clients.get(clientId);
      if (clientInfo) {
        console.log('Client info found on ready - authenticated');

        // Clear all timeouts bc QR has been authenticated
        if (clientInfo.generationTimeout) clearTimeout(clientInfo.generationTimeout);
        if (clientInfo.scanningTimeoutId) clearTimeout(clientInfo.scanningTimeoutId);
        
        // Mark client as authenticated
        clientInfo.authenticated = true;

        // Emit this conection event to socket handlers to notifify front end 
        console.log('Attempting to notify frontend');
        eventEmitter.emit('whatsapp-connected', clientId); 
        console.log('Notification attempted');
      } else {
        console.log('No client info found');
      }
    });

    client.on('disconnected', (reason) => {
      console.log(`WhatsApp connection closed. Reason: ${reason}`);
      this.clients.delete(clientId);
    });

    // Initialize the client
    client.initialize().catch(error => {
      console.error('Error initializing WhatsApp client:', error.message);
    });

    return qrPromise;
  },
  
  /**
   * 1. Logging out (clientInfo.client.logout())
   *  - Used in the logout() method when a user explicitly disconnects
   *  - Signals to WhatsApp servers to end the session 
   *  - Always followed by a 'whats-app disconnected' event 
   * 
   * 2. Destorying client (done in catch blocks and timouts)
   *  - Used primarily in error handling and timeout scenarios 
   *  - Terminated browswer resources without proper WhatsApp logout
   *  - Call in QR generation timeout and QR scan timeout handler 
   * 
   * 3. Deleteing from Map (this.clients.delete(clientId))
   *  - Used after both logout and destroy operaionts
   *  - Also used int he disconnected event handler 
   *  - Ensures that the applciation stops tracking terminated sessions 
   */
  logout: async function(phoneNumber) {
    const clientId = this.formatPhoneNumber(phoneNumber);
    const clientInfo = this.clients.get(clientId);
    
    if (!clientInfo) {
      throw new WhatsAppError('Cannot logout: Client not found'); 
    }

    try {
      await clientInfo.client.logout();
      // Emit the disconnect event before removing from clients map
      eventEmitter.emit('whatsapp-disconnected', clientId);
      this.clients.delete(clientId);
      return true;
    } catch (error) {
      console.error('Error logging out WhatsApp client:', error.message);
      throw new WhatsAppError(`Logout failed: ${error.message}`); 
    }
  },
  
 // Check if client is authenticated, return boolean 
  isAuthenticated: function(phoneNumber) {
    const clientId = this.formatPhoneNumber(phoneNumber);
    const clientInfo = this.clients.get(clientId);
    return clientInfo ? clientInfo.authenticated === true : false;
  },

  // Send message function
  // Returns promise object 
  sendMessage: async function(phoneNumber, recipient, content) {
    const clientId = this.formatPhoneNumber(phoneNumber);
    const clientInfo = this.clients.get(clientId);
    
    if (!clientInfo) return null;

    try {
      // TODO: use the format phonenumber funciton? 
      const formattedRecipient = recipient.includes('@s.whatsapp.net') 
        ? recipient.split('@')[0] 
        : recipient.replace(/[^0-9]/g, '');
      
      // Send the message 
      if (typeof content === 'string') {
        return await clientInfo.client.sendMessage(`${formattedRecipient}@c.us`, content);
      } else if (content.image) {
        // Handle image message
        const media = content.image instanceof Buffer 
          ? new MessageMedia('image/jpeg', content.image.toString('base64'))
          : await MessageMedia.fromUrl(content.image);
        
        return await clientInfo.client.sendMessage(
          `${formattedRecipient}@c.us`, 
          media, 
          { caption: content.caption || '' }
        );
      } else {
        // Other message types
        console.warn('Unsupported message type:', content);
        return null;
      }
    } catch (error) {
      throw new WhatsAppError(`Failed to send message: ${error.message}`)
    }
  },

  // Get the last 10 messages for a client
  getlast10Messageoflast5Chats: async function(phoneNumber) {
    const clientId = this.formatPhoneNumber(phoneNumber);
    const clientInfo = this.clients.get(clientId);
  
   if (!clientInfo || !clientInfo.authenticated) {
      console.log('Client not found or not authenticated');
      throw new WhatsAppError('Client not found or not authenticated');
    }

    try {
      const client = clientInfo.client;
      const chats = await client.getChats();
      
      // Limit to most recent 5 chats
      const recentChats = chats.slice(0, 5);
      
      // Get message info for each of the chats
      const chatData = await Promise.all(recentChats.map(async chat => {
        try {
          // Fetch the last 10 messages for this chat
          const chatMessages = await chat.fetchMessages({ limit: 10 });
          
          // Get contact info 
          const contact = await client.getContactById(chat.id._serialized);
          const contactName = contact.name || contact.pushname || chat.id.user;
          
          // Format messages for this chat
          const formattedMessages = chatMessages.map(msg => ({
            id: msg.id._serialized,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            timestamp: msg.timestamp,
            fromMe: msg.fromMe,
            hasMedia: msg.hasMedia,
            type: msg.type,
            chat: {
              id: chat.id._serialized,
              name: contactName
            }
          }));
          
          const needsResponse = chatMessages.length > 0 && chatMessages[0].fromMe === false;

          return {
            chatId: chat.id._serialized,
            contactName,
            needsResponse: needsResponse,  
            messages: formattedMessages
          };
        } catch (error) {
          console.error('Error processing chat:', error.message);
          return null;
        }
      }));
      
      // Filter out any null results from the Promise.all
      const validChats = chatData.filter(chat => chat !== null);
      
      // Return the structured data
      return validChats
      
    } catch (error) {
      console.error('Error getting messages:', error.message);
      throw new WhatsAppError(`Failed to retrieve messages: ${error.message}`)
    }
  },
  
  // Get or initialize a client (attempting to restore session if possible)
  getOrInitializeClient: async function(phoneNumber) {
    const clientId = this.formatPhoneNumber(phoneNumber);
    
    // If client already exists, return its status
    if (this.clients.has(clientId)) {
      const clientInfo = this.clients.get(clientId);
      return {
        client: clientInfo.client,
        authenticated: clientInfo.authenticated,
        requiresQR: false,
        error: null
      };
    }
    
    // Initialize the client
    try {
      const { qr, authenticated } = await this.getLoginQR(clientId);
      // If authenticated, restore session 
      if (authenticated) {
        return {
          client: this.clients.get(clientId).client,
          authenticated: true,
          requiresQR: false,
          error: null
        };
      } else {
        // Session couldn't be restored, QR needed
        return {
          client: null,
          authenticated: false,
          requiresQR: true,
          error: 'Client requires QR authentication'
        };
      }
    } catch (error) {
      return {
        client: null,
        authenticated: false,
        requiresQR: false,
        error: `Failed to initialize client: ${error.message}`
      };
    }
  }
};

module.exports = whatsappManager;
