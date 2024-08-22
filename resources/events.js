const request = require('request');

//get params from .env
const token = process.env.TOKEN;
const ollamaURL = process.env.OLLAMA_URL;
const model = process.env.MODEL;

const event = function(data) {};

/**
 * gets a specified amount of messages from chat history from the channel
 * @param {*} channel_id //if of channel command sent from
 * @param {*} limit //amount of messages to get
 * @param {*} callback //function to do after
 */
function getChatHistory(channel_id, limit, callback) {

    const slackHistoryOptions = {                                                                       //Data for POST request
        url: 'https://slack.com/api/conversations.history',                                             //endpoint for message history make sure to have correct bot perms
        method: 'POST',                                                                                 
        headers: {
            'Authorization': `Bearer ${token}`,                                                         //special bot token
            'Content-Type': 'application/json; charset=utf-8'
        },
        json: {                                                                                         //payload
            channel: channel_id,                                                                        //channel user sent command from (REQUIRED)
            limit: limit                                                                                //amount of messages to retrieve (NOT REQUIRED, DEFAULT = 100)
        }
    }
    request.post(slackHistoryOptions, (error, response, body) => {                                      //send the post request using options and callback function                 
        if (!error && response && response.statusCode === 200) {                                        //if ok
            const messages = body.messages                                                              //get the messages from the json
                .map(message => message.text)                                                           //get all the text fields (one for each chat message)
                .reverse()                                                                              //reverse so message go from top to bottom (this is necessary for ai prompt)   
                .join('\n');                                                                            //concat so we can send to ollama as prompt
            callback(null, messages);                                                                   //call the callback function
        } else {
            callback(error || new Error('Failed to fetch data from Slack API'));                        //else error, oops
        }
    }
);
};

/**
 * Makes requests to the ollama model
 * @param {*} prompt prompt for what to do with the user text i.e 'please summarise the following: '
 * @param {*} userText the user text to feed into the model for processing
 * @param {*} callback function to do after
 */
function requestOllama(prompt, userText, callback) {
    const ollamaOptions = {                                                                             //Data for ollama HTTP request
        url: ollamaURL,                                                                                 //endpoint for ollama model mine is locally running
        json: {
            model: model,                                                                               //the ollama model that you want to use (or in my case the only one installed)
            messages: [{ role: 'user', content: prompt + userText }],                                   //combine the prompt and usertext i.e please summarise: +  "........"
            stream: false                                                                               //false to the generated response is a whole string not split up                                                                                       
        }
    }

    request.post(ollamaOptions, (error, response, body) => {                                            //send the HTTP request
            if (!error && response && response.statusCode === 200) {                                    //if ok, 200
                const generatedText = body.message.content;                                             //get the ai response back
                console.log(generatedText);                                                         
                callback(null, generatedText);                                                          //send the ai text to the function to do next
            } else {
                callback(error || new Error('Failed to fetch data from Ollama API'));                   //else bad request, bad endpoint, bad something, oops
            }
        }
    );
}

/**
 * Post an Ephemeral message to slack
 * Ephemeral means only the user who sent the message can see and is temporary
 * @param {*} channel_id the channel user sent the command in
 * @param {*} user_id the user that sent the command
 * @param {*} generatedText the text to send as a message 
 */
function postEphemeral(channel_id, user_id, generatedText) {
    const slackEphemeralOptions = {                                                                     //Options for HTTPS request
        url: 'https://slack.com/api/chat.postEphemeral',                                                //slack api endpoint for Ephemeral messages
        method: 'POST',                                                                                 
        headers: {
            'Authorization': `Bearer ${token}`,                                                         //special bot token (REQUIRED)
            'Content-Type': 'application/json; charset=utf-8'
        },
        json: {
            channel: channel_id,                                                                        //the channel to send it to
            user: user_id,                                                                              //the user to send it to
            text: generatedText                                                                         //the text to send to the user
        }
    };

    request(slackEphemeralOptions, (error, response, body) => {                                         //send the request
        if (!error && response.statusCode === 200) {                                                    //if ok, 200
            console.log('Message Sent to Slack');                                                       //successfully posted the ephemeral message
        } else {
            console.error('Error:', body);                                                              //else bad payload, bad endpoint, bad something, oops!
        }
    });
}

//event handler for /suggest command handles suggesting a response to a specified message
//could maybe allow number instead like i.e 5 means message of index 5 up (message 5th up)
event.suggest = (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });     //no json, no good! exit
    }

    const apiPostBody = req.body;                                                                       //we have json!
    console.log(apiPostBody.command);

    res.status(200).send();                                                                             //send OK status asap to avoid repeat events(within 3000miliseconds)

    const prompt = 'how should I respond to: ';                                                         //prompt hardcoded for now but could be customisable in future
    
    requestOllama(prompt, apiPostBody.text, (error, generatedText) => {                                 //make a request to Ollama using the prompt and text i.e please summarise: "......."
        if (error) {
            console.error('Error:', error);                                                             //bad request
        } else {                                                                                        //good request :)
            postEphemeral(apiPostBody.channel_id, apiPostBody.user_id, generatedText);                  //send the Ephemeral message to Slack with the AI-generated text
        }
    });
};

//handles the /summarise command 
//summarise specified previous messages 
event.summarise = (req, res) => {
    if (!req.body) {                                                                                    //no json, NO GOOD!
        return res.status(400).send({ message: 'An error occured while processing the request' });      //send 400 error!
    }

    const apiPostBody = req.body;                                                                       //we have json! parse the body
    console.log(apiPostBody.command);


    res.status(200).send();                                                                             //send status ASAP to avoid slack sending repeat events - 3000 milisecond window

    limit = apiPostBody.text;                                                                           //how many messages to summarise (i.e '5' -> last 5 messages)
    
    if(isNaN(limit)){                                                                                   //check its an int cause im not parsing words for numbers thats dumb
        const ERRmessage = 'Please pass number of previous messages to summarise :|    i.e 5'
        postEphemeral(apiPostBody.channel_id, apiPostBody.channel_id, ERRmessage);                      //send user an error message and tell em how not to be dumb
        return;                                                                                         //dont do anything else
    }

    const prompt = 'can you please summarise these messages consisely: \n';                             //prompt to concat with messages for ai to process

    getChatHistory(apiPostBody.channel_id, apiPostBody.text, (error, messages) => {                     //get the specified amount of messages from the chat history and a callback
        if (error) {
            console.error('Error:', error);                                                             //bad request, bad endpoint idk
        } else {
            console.log(prompt + messages);
            requestOllama(prompt, messages, (error, generatedText) => {                                 //send the prompt and messages to the model
                if (error) {
                    console.error('Error:', error);                                                     //bad request, bad endpoint idk
                } else {
                    postEphemeral(apiPostBody.channel_id, apiPostBody.user_id, generatedText);          //send the ephemeral message to Slack with the AI-generated text
                }
            });
        }
    });
};

// Export the model and handler functions
module.exports = event;
