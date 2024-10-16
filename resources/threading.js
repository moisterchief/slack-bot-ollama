const { getName, getThreadMessages, getToken, postThreadedReply, getBotID } = require('./slack_requests');
const { requestOllama } = require('./ollama_handler');
require('dotenv').config({ path: './.env' });
const axios = require('axios');

const initialPrompt =`You provide advanced technical support, assume users have a high level of knowledge, only explain things if they don't understand. Your answers must be as short as necessary.`;


async function repondUserHelpRequest(event) {

    if (!event.text) return; // Ignore messages without text

    const token = await getToken(event.team);
    const bot_id = await getBotID(token);

    if(event.user === bot_id) return;

    try {
        console.log("Received message text:", event.text);

        const userName = await getName(event.user, token);
        let messages = '';
        if (event.thread_ts) {
            let threadMessages = await getThreadMessages(event.channel, event.thread_ts, token);

            const messagesArray = threadMessages.messages; 

            // If the first message doesn't contain --help then this thread is not a support thread
            if (!messagesArray[0].text.toLowerCase().includes('--help')) {
                return;
            }
            
            messages = await Promise.all(
                messagesArray.map(async (message) => {
                    let userName = '';
                    if(message.user === bot_id){
                        userName = 'You Replied'
                    }
                    else{
                        userName = await getName(message.user, token);
                    }
                    return `${userName}: ${message.text}`;
                })
            );
            messages = messages.join('\n');
        }
        
        const context = `THE CHAT HISTORY SO FAR:\n${messages}\n\nREPLY TO THIS NEW MESSAGE: ${event.text}`;


        const responseText = await requestOllama(initialPrompt, context);
        console.log("Ollama API Response:", responseText);

        await postThreadedReply(event.channel, responseText, event.ts, token);
    } catch (error) {
        console.error("Error during message processing:", error);
        const text = "There was an error processing your request.";
        await postThreadedReply(event.channel, text, event.ts, token);
    }
};

module.exports = {repondUserHelpRequest};