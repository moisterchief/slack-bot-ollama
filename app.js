//import required modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const events = require('./resources/events.js'); //custom module for handling events
const PORT = process.env.PORT;

const { App } = require('@slack/bolt');

//create an express applications
const app = new App({
    token: process.env.TOKEN,
    signingSecret: process.env.SIGNING_SECRET
  });

const port = PORT; //server port

//serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
//parse json request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));

// Listen for messages in channels
app.message(async ({ message, say, context }) => {
  // Ignore messages from bots
  if (message.subtype && message.subtype === 'bot_message') {
    return;
  }

  try {
    // Extract data from the incoming message
    const channelId = message.channel;
    const userMessage = message.text;
    const threadTs = message.ts;
    const teamId = context.team_id;

    console.log('Received message:', userMessage);

    // Get token based on the team ID
    const token = await getToken(teamId);

    // Send an initial message (threaded reply)
    await postMessage(channelId, threadTs, 'Processing your request...', token);

    // Add chat history to context and generate response
    const contextText = `\nUSING THIS CHAT HISTORY PLEASE ANSWER: ${userMessage}`;
    const chatHistory = await getChatHistory(channelId, 999, token); // Fetch chat history

    // Generate response using your external function (e.g., AI model)
    const generatedText = await requestOllama(chatHistory, contextText);

    // Send the generated response in the same thread
    await postMessage(channelId, threadTs, generatedText, token);

  } catch (error) {
    console.error('Error processing message:', error.message);
    await say('An error occurred while processing your request.');
  }
});

//define routes for handling different HTTP methods and paths
//listens /suggest commands
app.post('/suggest', events.suggest);
app.post('/summarise', events.summarise);
app.get('/oauth-redirect', events.oauthRedirect);
app.post('/endpoint', events.endpoint);
app.post('/ask', events.ask);
app.post('/askThreaded', events.askThreaded);
//start the express server and listen for incoming connections
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
})

