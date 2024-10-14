const axios = require('axios');
const { insertChannel, getChannelByTeamId } = require('./token_db');
const {getToken, getChatHistory, postEphemeral, getBotID, getName, postMessage} = require('./slack_requests')
const { getChannelsForTeam, insertMessage } = require('./messages_db');
const { getMessageStatistics } = require('./message_stats');
const { requestOllama } = require('./ollama_handler');
const { repondUserHelpRequest } = require('./threading');
const { getChannelMessagesAsStringWithUsername, addMessage, addNewChannelData} = require('./context_handler');
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
        // console.log(apiPostBody.event);
        if(apiPostBody.event.thread_ts || apiPostBody.event.text.toLowerCase().indexOf('--help') > -1){
            await repondUserHelpRequest(apiPostBody.event);
        }
        await addMessage(apiPostBody.event);
        // if(apiPostBody.event.text.includes('--help')){
        //     await repondUserHelpRequest(apiPostBody.event);
        // }

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
        const prompt = '\n whats the best way to respond to this';
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
        const prompt = '\nUSING THIS CHAT HISTORY PLEASE ANSWER: ' + apiPostBody.text;
        // const prompt = await getChatHistory(apiPostBody.channel_id, 999, token);
        const context = await getChannelMessagesAsStringWithUsername(apiPostBody.team_id, apiPostBody.channel_id, 999);
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
        const prompt = '\n can you please concisely summarise what these messages are about';
        const messages = await getChatHistory(apiPostBody.channel_id, limit, token);
        // console.log(messages);
        const generatedText = await requestOllama(prompt, messages);
        await postEphemeral(apiPostBody.channel_id, apiPostBody.user_id, generatedText, token);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

event.stats = async (req, res) => {
    if(!req.body){
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }

    const apiPostBody = req.body;

    const {channel_id: channel_id, team_id: team_id, text: text, command: command, user_id: user_id} = apiPostBody
    console.log(command, text);

    res.status(200).send();

    try{
        const token = await getToken(team_id);
        const stats = await getMessageStatistics(channel_id, token);
    
        await postEphemeral(channel_id, user_id, stats, token);
        console.log("Sent Stats");
    } catch(error) {
        console.log('Error: ', error.message);
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


// async function handleQuestion(team_id, channel_id, user_id, user, text, token) {
//     await postMessage(channel_id, user_id, '....', token);
//     const prompt = `\n___________________________________________________________\nTHE CHAT HISTORY IS THERE FOR CONTEXT - please answer ${user}'s question: ${text}`;
    
//     const context = await getChannelMessagesAsStringWithUsername(team_id, channel_id);
//     const generatedText = await requestOllama(prompt, context);

//     console.log(prompt + '\n' + context);
//     await postMessage(channel_id, user_id, generatedText, token);
// }

// Export the model and handler functions
module.exports = event;


