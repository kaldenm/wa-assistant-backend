require('dotenv').config();
const OpenAI = require('openai');
const { OpenAIError } = require('../errorClasses');

async function sendChatsToOpenAi(chat) {
    try {
    // Check if the most recent message has a body
    const mostRecentMessage = chat.messages[chat.messages.length - 1];

    if (!mostRecentMessage.body) {
        console.log('Skipping chat because the most recent message has no text content');
        throw new OpenAIError('Most recent message contains no text content to process');
    }
    
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
        
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are a WhatsApp conversation assistant for ${chat.contactName}. Your output must follow this exact format:
                    KEY POINTS (max 3 bullet points):
                    • [point 1]
                    • [point 2]
                    • [point 3]

                    SUGGESTED ENGAGEMENT:
                    [Ask one specific question or make one specific request that moves the conversation forward, directly related to the most recent topic discussed]
                    Keep all points brief. Total response should not exceed 150 words.`
            },
            {
                role: "user",
                content: `CONVERSATION HISTORY:
                    ${JSON.stringify(chat.messages)}
                    MOST RECENT MESSAGE:
                     "${mostRecentMessage.body}"
                    Format your response using the template above, focusing on the most recent topic.`
                }
            ],
            temperature: 0.7,
        });

        console.log(`Received response from OpenAI`);
        return {
            content: response.choices[0].message.content,
            chatName: chat.contactName
        };
    } catch (error) {
        console.error(`❌ OPENAI ERROR: ${error.message}`);
        throw new OpenAIError(`OpenAI processing failed: ${error.message}`);
    }
}

module.exports = {
    sendChatsToOpenAi
};
