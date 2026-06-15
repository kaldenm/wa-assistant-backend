// Centralize all socket.io event handlers and notifications 

const eventEmitter = require('./events');
// const { notifyWhatsAppConnection, notifyWhatsAppDisconnection } = require('./server');

function initializeSocketHandlers(io) {
  // Set up connection handler 
  io.on('connection', (socket) => {
    console.log('Client connected to Websocket');
  });

  // Create notifications functions 
  const notifications = {
    notifyWhatsAppConnection: (phoneNumber) => {
      console.log('Attempting to notify frontend about WhatsApp connection');
      io.emit('whatsapp-connected', { phoneNumber });
      console.log('Emitted whatsapp-connected event');
    },

    notifyWhatsAppDisconnection: (phoneNumber) => {
      console.log('Attempting to notify frontend about WhatsApp disconnection');
      io.emit('whatsapp-disconnected', { phoneNumber });
      console.log('Emitted whatsapp-disconnected event');
    },

    notifyQRScanExpired: (phoneNumber) => {
      console.log('Attempting to emit expired QR scanning window event');
      io.emit('qr-scan-expired', { phoneNumber });
      console.log('Emitted QR scan expired event');
    },

    notifyQRGenerationExpired: (phoneNumber) => {
      console.log('Attempting to emit expired QR generation window event');
      io.emit('qr-generation-expired', { phoneNumber });
      console.log('Emitted QR generation expired event');
    } 
  };

  // Set up event listeners
  eventEmitter.on('whatsapp-connected', notifications.notifyWhatsAppConnection);
  eventEmitter.on('whatsapp-disconnected', notifications.notifyWhatsAppDisconnection);
  eventEmitter.on('qr-scan-expired', notifications.notifyQRScanExpired);
  eventEmitter.on('qr-generation-expired', notifications.notifyQRGenerationExpired);

  return notifications; 
}

module.exports = initializeSocketHandlers;
