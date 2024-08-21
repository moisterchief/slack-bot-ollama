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
//CRUD operations
// app.post('/events', events.createEvent); //create a new event 
// app.get('/events', events.getAllEvents); //get all events
// app.get('/events/:id', events.getEventById); //get an event by its ID
// app.get('/events/name/:name', events.getEventByName); //get an event by its name
// app.put('/events/:id', events.updateEventById); //update an event by its ID
// app.delete('/events/:id', events.deleteEventById); //delete an event by its ID
// app.delete('/events', events.deleteAllEvents); //Delete all events
app.post('/slack/action-endpoint', events.slackEndpoint); 

//start the express server and listen for incoming connections
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
})

