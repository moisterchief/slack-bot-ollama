//import required modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const events = require('./resources/events.js'); //custom module for handling events
const PORT = process.env.PORT;

//create an express applications
const app = express();
const port = PORT; //server port

//serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
//parse json request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));

//define routes for handling different HTTP methods and paths

//listens to event subscriptions
//app.post('/slack/action-endpoint', events.slackEndpoint); 

//listens /suggest commands
app.post('/suggest', events.suggest);
app.post('/summarise', events.summarise);
app.get('/oauth-redirect', events.oauthRedirect);
app.post('/endpoint', events.endpoint);
app.post('/ask', events.ask);
app.post('/slack/events', meow);

function meow(){
    console.log("meow");
}

//start the express server and listen for incoming connections
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
})

