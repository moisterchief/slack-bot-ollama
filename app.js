//import required modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const events = require('./resources/events.js'); //custom module for handling events

//create an express applications
const app = express();
const port = 3000; //server port

//serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
//parse json request bodies
app.use(bodyParser.json());

//define routes for handling different HTTP methods and paths
app.post('/slack/action-endpoint', events.slackEndpoint); 

//start the express server and listen for incoming connections
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
})

