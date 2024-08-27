const axios = require('axios');
const { insertChannel, getChannelByTeamId } = require('../db');

const ollamaURL = process.env.OLLAMA_URL;
const model = process.env.MODEL;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const hostURL = process.env.HOST_URL;

const event = () => {}

async function getToken(team_id) {
    try {
        const row = await getChannelByTeamId(team_id);
        return row.access_token;
    } catch (err) {
        console.error(err.message);
        throw new Error('Failed to retrieve access token');
    }
}


/**
 * gets a specified amount of messages from chat history from the channel
 * @param {*} channel_id if of channel command sent from
 * @param {*} limit amount of messages to get
 */
async function getChatHistory(channel_id, limit, token) {
    try {
        const response = await axios.post('https://slack.com/api/conversations.history', {
            channel: channel_id,
            limit: limit
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        if (response.data.ok) {
            const messages = response.data.messages
                .map(message => message.text || '')
                .reverse()
                .join('\n');
            return messages;
        } else {
            throw new Error(`Slack API Error: ${response.data.error}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch chat history');
    }
}

async function requestOllama(prompt, userText) {
    try {
        const response = await axios.post(ollamaURL, {
            model: model,
            messages: [{ role: 'user', content: prompt + userText }],
            stream: false
        });

        const generatedText = response.data.message.content;
        console.log(generatedText);
        return generatedText;
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch data from Ollama API');
    }
}

async function postEphemeral(channel_id, user_id, generatedText, token) {
    try {
        await axios.post('https://slack.com/api/chat.postEphemeral', {
            channel: channel_id,
            user: user_id,
            text: generatedText
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
        console.log('Message Sent');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

event.suggest = async (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }

    const apiPostBody = req.body;
    console.log(apiPostBody.command, apiPostBody.text);

    res.status(200).send();

    try {
        const token = await getToken(apiPostBody.team_id);
        const prompt = 'how should I respond to: ';
        const generatedText = await requestOllama(prompt, apiPostBody.text);
        await postEphemeral(apiPostBody.channel_id, apiPostBody.user_id, generatedText, token);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

event.summarise = async (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }

    const apiPostBody = req.body;
    console.log(apiPostBody.command, apiPostBody.text);

    res.status(200).send();

    try {
        const token = await getToken(apiPostBody.team_id);
        const limit = parseInt(apiPostBody.text, 10);

        if (isNaN(limit)) {
            const ERRmessage = 'Please pass number of previous messages to summarise :| i.e 5';
            await postEphemeral(apiPostBody.channel_id, apiPostBody.user_id, ERRmessage, token);
            return;
        }

        const prompt = 'can you please summarise these messages concisely: \n';
        const messages = await getChatHistory(apiPostBody.channel_id, limit, token);
        const generatedText = await requestOllama(prompt, messages);
        await postEphemeral(apiPostBody.channel_id, apiPostBody.user_id, generatedText, token);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

event.oauthRedirect = async (req, res) => {
    try {
        if (!req.query.code) {
            return res.status(400).send({ message: 'Missing authorization code.' });
        }

        const code = req.query.code;
        // console.log('Authorization code:', code);

        const params = new URLSearchParams();
        params.append('code', code);
        params.append('client_id', client_id);
        params.append('client_secret', client_secret);
        params.append('redirect_uri', hostURL + '/oauth-redirect');

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        };

        const response = await axios.post('https://slack.com/api/oauth.v2.access', params.toString(), { headers });
        const data = response.data;

        if (!data.ok) {
            console.error('Slack OAuth Error:', data.error);
            return res.status(400).send({ message: 'Slack OAuth failed.', error: data.error });
        }

        const team_id = data.team.id;
        const access_token = data.access_token;
        const team_name = data.team.name;

        await insertChannel(team_id, access_token);
        res.status(200).send({ message: 'Slack app installed', team_name, team_id });
    } catch (error) {
        console.error('Error during OAuth process:', error.message);
        res.status(500).send({ message: 'An error occurred during the OAuth process.' });
    }
}

// Export the model and handler functions
module.exports = event;
