const whatsappManager = require('./whatsappClientManager');
const { sendChatsToOpenAi } = require('./openai');
const { WhatsAppError, OpenAIError, ChatProcessingError } = require('../errorClasses');
/**
 * Summarize recent messages and send responses to the user
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<Object>} - Status of the process
 */
async function summarizeMessagesAndSendToUser(phoneNumber) {
    const failedChats = [];

    try { 
        // Initialize whatsapp client
        const client = await whatsappManager.getOrInitializeClient(phoneNumber);

        // Get recent 10 messages from most recent 5 chats. 
        const last10Chats = await whatsappManager.getlast10Messageoflast5Chats(phoneNumber, client);

        // Filter for chats that need a response bc the latest message isn't from user. 
        const chatsThatNeedResponse = filterChatsForResponse(last10Chats);

        // Process each chat context individually and wrap in try block so that if one chat fails the rest continue in loop. 
        for (const chat of chatsThatNeedResponse) {
            try {
                // Send context to ai for summary and suggested engagement.
                const aiResponse = await sendChatsToOpenAi(chat);

                // Format the complete message with header and content. 
                const formattedMessage = formatWhatsAppMessage(aiResponse, chat.contactName);

                // Send ai response to user's whatsapp chat with themselves. Use formatted message. 
                await whatsappManager.sendMessage(
                    phoneNumber, //vSender's phone number
                    phoneNumber, // Recipient's phone number (same as sender)
                    formattedMessage,
                    client
                );
            } catch (error) {
                // Collect the failed chats with relevant error type.  
                failedChats.push({
                    contactName: chat.contactName,
                    chatId: chat.chatId,
                    errorType: error instanceof OpenAIError ? 'OpenAIError' : 'WhatsAppError',
                    error: error.message
                });
                continue;
            }
        }

       // Return results, including both successful and failed chats if any
        return {
            type: 'PROCESSING_COMPLETE',
            failedChats: failedChats.length > 0 ? failedChats : null
        }

    } catch (error) {
        // Handle errors here. 
        if (error instanceof WhatsAppError && error.message.includes('WhatsApp authentication required - QR code generated')) {
            return error.message;
        }

        if (error instanceof OpenAIError) {
            console.log('OpenAI Error:', error.message);
            return {
                type: 'OPENAI_ERROR',
                message: error.message
            };
        }

        if (error instanceof ChatProcessingError) {
            console.log('Chat Processing Error:', error.message);
            return {
                type: 'CHAT_ERROR',
                message: error.message
            };
        }
        // Catch any unexpected errors
        return {
            type: 'UNKNOWN_ERROR',
            message: error.message
        };
    }
}


const filterChatsForResponse = (last10Chats) => {  
    const filteredChats = last10Chats.filter(chat => {
        // Check if this chat has any messages to filter
        if (!chat.messages || chat.messages.length === 0) {
            console.log('Chat has no messages, skipping');
            return false;
        }
        
        // Most recent message in this chat 
        const lastMessage = chat.messages[0]; 

        // Keep only the chats where the last message is not from the current user 
        return lastMessage.fromMe === false; 
    });
        
    // If there are no chats that need a rsponse, throw an error. 
    if (filteredChats.length === 0) {
        console.log("No chats require response - throwing error");
        throw new ChatProcessingError('No chats require response');
    } 

    return filteredChats;
}

function formatWhatsAppMessage(aiResponse, contactName) {
    const header = `===== CHAT WITH ${contactName.toUpperCase()} =====\n\n`;
    const content = aiResponse.content;
    
    return header + content;
}

module.exports = {
    summarizeMessagesAndSendToUser,
    filterChatsForResponse,
    formatWhatsAppMessage
};
