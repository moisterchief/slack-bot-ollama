const request = require('request');

const event = function(data) {};

event.slackEndpoint = (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }

    const apiPostBody = req.body;
    console.log(apiPostBody);

    if (apiPostBody.type === 'url_verification') {
        return res.send(apiPostBody.challenge);
    }

    if (apiPostBody.type === 'event_callback') {
        const token = process.env.TOKEN;

        //send ok status asap to avoid repeat events
        res.status(200).send();
        

        // First, send a request to the local API to get the text
        request.post(
            process.env.OLLAMA_URL,
            {
                json: {
                    model: process.env.MODEL,
                    messages: [{ role: 'user', content: apiPostBody.event.text }],
                    stream: false
                }
            },
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const generatedText = body.message.content;  // Assuming the local API returns the generated text in a 'text' field
                    console.log(body);
                    // Now, send the ephemeral message to Slack with the generated text
                    const slackOptions = {
                        url: 'https://slack.com/api/chat.postEphemeral',
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        json: {
                            channel: apiPostBody.event.channel,
                            user: apiPostBody.event.user,
                            text: generatedText
                        }
                    };

                    request(slackOptions, (slackError, slackResponse, slackBody) => {
                        if (!slackError && slackResponse.statusCode === 200) {
                            console.log(slackBody); // Successfully posted the ephemeral message
                        } else {
                            console.error('Error:', slackBody); // Log any errors
                        }
                    });
                } else {
                    console.error('Error:', body); // Log any errors from the local API
                    res.status(response.statusCode).send(body); // Send the error response back to the client
                }
            }
        );
    }
};

// Export the model and handler functions
module.exports = event;
