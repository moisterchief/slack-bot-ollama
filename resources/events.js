const axios = require('axios');
const { insertChannel, getChannelByTeamId } = require('./db');
const {getToken, getChatHistory, postEphemeral, requestOllama, getChannelData, getChannelMessagesAsString, getBotID, storeChatMessages, getName, postMessage} = require('./requests')
const { getChannels, insertMessage } = require('./messages');
const { post } = require('request');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const HOST_URL = process.env.HOST_URL;

const event = () => {}
const unansweredQuestions = new Map();

event.endpoint = async (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: 'An error occurred while processing the request' });
    }

    const apiPostBody = req.body;

    if (apiPostBody.type === 'url_verification') {
        return res.send(apiPostBody.challenge);
    }
    else if (apiPostBody.event.type === 'message') {
        await checkAndAddMessage(apiPostBody.event);
    }
    else if (apiPostBody.event.type === 'member_joined_channel'){
        await addNewChannelData(apiPostBody.event);
    }

    res.status(200).send();

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
        const prompt = await getChannelMessagesAsString(apiPostBody.channel_id);
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
    const { channel: channel_id, user: user_id, text, ts: timestamp, team: team_id } = apiPostBody;
    const token = await getToken(team_id);
    const bot_id = await getBotID(token);

    if (user_id !== bot_id) {
        const username = await getName(user_id, token);
        const message_text = `${username} said ${text}`;

        const channels = await getChannels();
        if (channels.includes(channel_id)) {
            if (message_text.includes('??')) {
                await handleQuestion(channel_id, user_id, message_text, token);
            }

            detectQuestion(message_text, channel_id, user_id, timestamp,team);
            detectAnswer(message_text, channel_id, user_id);

            await insertMessage(timestamp, team_id, channel_id, username, user_id, message_text);
        }
    }
}

async function handleQuestion(channel_id, user_id, message_text, token) {
    await postMessage(channel_id, user_id, '....', token);
    const context = `\nUSING THIS CHAT HISTORY PLEASE ANSWER: ${message_text}`;
    const prompt = await getChannelMessagesAsString(channel_id);
    const generatedText = await requestOllama(prompt, context);
    await postMessage(channel_id, user_id, generatedText, token);
}

function detectQuestion(message_text, channel_id, user_id, timestamp, team)
{
    if(message_text.includes('?'))
    {
        storeUnansweredQuestions(channel_id, user_id, timestamp, message_text, team);
    }
}

async function detectAnswer(message_text, channel_id, user_id,)
{
    for(const [timestamp, question] of unansweredQuestions.entries())
    {
        if(channel_id === question.channel_id)
        {
            const isAnswer = await checkIfAnswered(question.question_text, message_text);
                
            if(isAnswer)
            {
                unansweredQuestions.delete(timestamp);
                console.log(`Question answered: ${question.question_text}`)
                break;
            }   
        }
    }
}

async function checkUnansweredQuestions()
{
    const now = Date.now();
    const reminderThreshold = 1 * 60 * 1000;
    console.log("Just waiting...");

    if(unansweredQuestions.size === 0)
    {
        console.log('No questions');
    }

    for (const [timestamp, question] of unansweredQuestions.entries())
    {
        const timeElapsed = now - question.timestamp;
        console.log(now - question.timestamp);
        if(timeElapsed > reminderThreshold)
        { 
            const token = await getToken(question.team);
            await postMessage(question.channel_id, question.user_id, `Reminder: question: ${question.question_text}`, token);
            unansweredQuestions.delete(timestamp);
        }
    }
}

async function checkIfAnswered(question, message) 
{
    try
    {
        console.log("here...");
        const prompt = `Question: ${question}\n Response: ${message}\n Does this response answer the question? respond with "yes" or "no".`;
        const generatedResponse = await requestOllama(prompt, '');
        console.log(prompt);
        console.log(generatedResponse);
        if(generatedResponse.toLowerCase().includes('yes'))
        {
            console.log("was answered");
            return true;
        }
        else
        {
            console.log("was not answered");
            return false;
        }
    }
    catch (error)
    {
        console.error('Error while checking answer with Ollama:', error.message);
        return false;
    }
}

function storeUnansweredQuestions(channel_id, user_id, timestamp, question_text, team)
{
    unansweredQuestions.set(timestamp, {channel_id: channel_id, user_id: user_id, question_text: question_text, timestamp: timestamp, team: team});
    console.log(channel_id);
    console.log(`Question detected: ${question_text}`);
}

event.checkUnansweredQuestions = checkUnansweredQuestions;

// Export the model and handler functions
module.exports = event;


