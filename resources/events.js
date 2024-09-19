const axios = require('axios');
const { insertChannel, getChannelByTeamId } = require('./db');
const {getToken, getChatHistory, postEphemeral, requestOllama, getChannelData, retrieveChatMessagesByChannel, getBotID, storeChatMessages, getName, postMessage} = require('./requests')
const { getChannels, insertMessage } = require('./messages');
const { post } = require('request');

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const hostURL = process.env.HOST_URL;

const event = () => {}

/**
 * for event verification
 */
event.endpoint = async (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }

    res.status(200).send();
    const apiPostBody = req.body;

    console.log(apiPostBody.event);
    if (apiPostBody.type === 'url_verification') {
        return res.send(apiPostBody.challenge);
    }
    else if (apiPostBody.event.type === 'message') {
        await checkAndAddMessage(apiPostBody);
    }
    else if (apiPostBody.event.type === 'member_joined_channel'){
        await addNewChannelData(apiPostBody);
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

event.ask = async (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }

    const apiPostBody = req.body;
    console.log(apiPostBody.command, apiPostBody.text);

    res.status(200).send();
    try {
        const token = await getToken(apiPostBody.team_id);
        await postEphemeral(apiPostBody.channel_id, apiPostBody.user_id, '....', token);
        const context = '\nUSING THIS CHAT HISTORY PLEASE ANSWER: ' + apiPostBody.text;
        // const prompt = await getChatHistory(apiPostBody.channel_id, 999, token);
        const prompt = await retrieveChatMessagesByChannel(apiPostBody.channel_id)
        console.log(prompt);
        const generatedText = await requestOllama(prompt, context);
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

        const prompt = 'can you please concisely summarise what these messages are about: \n';
        const messages = await getChatHistory(apiPostBody.channel_id, limit, token);
        console.log(messages);
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

        // getChannelData(team_id, access_token);
    } catch (error) {
        console.error('Error during OAuth process:', error.message);
        res.status(500).send({ message: 'An error occurred during the OAuth process.' });
    }
}

async function addNewChannelData(apiPostBody) {
    const joined_user = apiPostBody.event.user;
    const channel = apiPostBody.event.channel;
    const team = apiPostBody.event.team;
    const token = await getToken(team);
    const bot_id = await getBotID(token);

    if (joined_user === bot_id) {
        storeChatMessages(channel, team, 999, token);
    }
}

async function checkAndAddMessage(apiPostBody) {
    const channel_id = apiPostBody.event.channel;
    const user_id = apiPostBody.event.user;
    const team_id = apiPostBody.event.team;
    const token = await getToken(team_id);
    const username = await getName(user_id, token);
    const message_text = username + ' said ' + apiPostBody.event.text;
    const timestamp = apiPostBody.event.ts;
    const bot_id = await getBotID(token);
    try {
        // Get all unique channel IDs from the database
        const channels = await getChannels();

        // Check if the current message's channel exists in the database
        if (channels.includes(channel_id)) {

            if(message_text.includes('??') && user_id != bot_id){
                try {
                    await postMessage(channel_id, user_id, '....', token);
                    const context = '\nUSING THIS CHAT HISTORY PLEASE ANSWER: ' + message_text;
                    const prompt = await retrieveChatMessagesByChannel(channel_id)
                    console.log(prompt);
                    const generatedText = await requestOllama(prompt, context);
                    await postMessage(channel_id, user_id, generatedText, token);
                } catch (error) {
                    console.error('Error:', error.message);
                }
            }
            console.log(`Channel ${channel_id} exists in the database. Inserting message...`);

            await insertMessage(timestamp, team_id, channel_id, username, user_id, message_text);

        } else {
            console.log(`Channel ${channel_id} does not exist in the database.`);
        }
    } catch (error) {
        console.error('Error processing message:', error.message);
    }
}

// Export the model and handler functions
module.exports = event;


