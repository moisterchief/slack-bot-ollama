const axios = require('axios');
const { insertChannel, getChannelByTeamId } = require('./token_db');
const {getToken, getChatHistory, postEphemeral, requestOllama, getChannelData, getChannelMessagesAsString, getBotID, storeChatMessages, getName, postMessage} = require('./slack_requests')
const { getChannelsForTeam, insertMessage } = require('./messages_db');
require('dotenv').config({ path: './.env' });

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const HOST_URL = process.env.HOST_URL;

const event = () => {}

event.endpoint = async (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }


    const apiPostBody = req.body;

    if (apiPostBody.type === 'url_verification') {
        return res.status(200).send(apiPostBody.challenge);
    }
    
    res.status(200).send();
    if (apiPostBody.event.type === 'message' && apiPostBody.event.subtype == null) {
        console.log(apiPostBody.event);
        await checkAndAddMessage(apiPostBody.event);
    }
    else if (apiPostBody.event.type === 'member_joined_channel'){
        await addNewChannelData(apiPostBody.event);
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
        const prompt = await getChannelMessagesAsString(apiPostBody.team_id, apiPostBody.channel_id);
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

        const params = new URLSearchParams();
        params.append('code', code);
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('redirect_uri', HOST_URL + '/oauth-redirect');

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        };

        const response = await axios.post('https://slack.com/api/oauth.v2.access', params.toString(), { headers });
        const data = response.data;

        if (!data.ok) {
            console.error('Slack OAuth Error:', data.error);
            return res.status(400).send({ message: 'Slack OAuth failed.', error: data.error });
        }

        const {id: team_id, name: team_name} = data.team;
        const access_token = data.access_token;

        await insertChannel(team_id, access_token);
        res.status(200).send({ message: 'Slack app installed', team_name, team_id });

    } catch (error) {
        console.error('Error during OAuth process:', error.message);
        res.status(500).send({ message: 'An error occurred during the OAuth process.' });
    }
}

async function addNewChannelData(apiPostBody) {
    const { user: joined_user, channel: channel, team: team} = apiPostBody;
    const token = await getToken(team);
    const bot_id = await getBotID(token);

    if (joined_user === bot_id) {
        storeChatMessages(channel, team, 999, token);
    }
}

async function checkAndAddMessage(apiPostBody) {
    // console.log(apiPostBody);
    const { channel: channel_id, user: user_id, text, ts: timestamp, team: team_id } = apiPostBody;
    const token = await getToken(team_id);
    const bot_id = await getBotID(token);
    const username = await getName(user_id, token);
    if (user_id !== bot_id) {
        
        const message_text = `${username}: ${text}`;

        const channels = await getChannelsForTeam(team_id);
        if (channels.includes(channel_id)) {
            if (message_text.includes('??')) {
                await handleQuestion(team_id, channel_id, user_id, username, text, token);
            }
            await insertMessage(timestamp, team_id, channel_id, username, user_id, message_text);
        }
    }
    else{
        await insertMessage(timestamp, team_id, channel_id, username, user_id, `(BOT) YOU REPLIED: ${text}`); 
    }
}

async function handleQuestion(team_id, channel_id, user_id, user, text, token) {
    await postMessage(channel_id, user_id, '....', token);
    const context = `\n___________________________________________________________\nTHE CHAT HISTORY IS THERE FOR CONTEXT - please answer ${user}'s question: ${text}`;
    
    const prompt = await getChannelMessagesAsString(team_id, channel_id);
    const generatedText = await requestOllama(prompt, context);

    console.log(prompt + '\n' + context);
    await postMessage(channel_id, user_id, generatedText, token);
}

// Export the model and handler functions
module.exports = event;


