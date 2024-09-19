const axios = require('axios');
const { insertChannel, getChannelByTeamId } = require('./db');
const { insertMessage, getMessagesByChannel, initializeDatabase } = require('./messages');
const { post, get } = require('request');

const ollamaURL = process.env.OLLAMA_URL;
const model = process.env.MODEL;

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
            const messages = await Promise.all(
                response.data.messages.map(async (message) => {
                    const userName = await getName(message.user, token);
                    // return `${(d = new Date(message.ts * 1000).toISOString())} ${userName} said ${message.text || ''}`;
                    return `${userName} said ${message.text || ''}`;
                })
            );
            return messages.reverse().join('\n');
        } else {
            throw new Error(`Slack API Error: ${response.data.error}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch chat history');
    }
}

async function getName(userID, token) {
    try {
        const response = await axios.get('https://slack.com/api/users.info', {
            params: {
                user: userID
            },
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        if (response.data.ok) {
            return response.data.user.real_name;
        } else {
            console.log(userID + ' Not Found')
            return 'Bot'
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch User name');
    }
}

async function getChannelData(team_id, token) {
    try {
        const response = await axios.get('https://slack.com/api/conversations.list', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        if (response.data.ok) {
            channel_ids = response.data.channels.map(channel => channel.id);

            channel_ids.forEach(channel => {
                storeChatMessages(channel, team_id, 999, token);
            });
        } else {
            throw new Error(`Slack API Error: ${response.data.error}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch channels');
    }
}

async function retrieveChatMessagesByChannel(channel_id) {
    rows = await getMessagesByChannel(channel_id, 999);

    return context = rows.map(row => row.message_text).join('\n');
}

/**
 * gets a specified amount of messages from chat history from the channel
 * @param {*} channel_id if of channel command sent from
 * @param {*} limit amount of messages to get
 */
async function storeChatMessages(channel_id, team_id, limit, token) {
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
            response.data.messages.map(async (message) => {
                const userName = await getName(message.user, token);
                insertMessage(message.ts, team_id, channel_id, userName, message.user, userName + ' said ' + message.text);
            })
        } else {
            // throw new Error(`Slack API Error: ${response.data.error}`);
            console.log('not in channel', response.data);
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

async function getBotID(token) {
    try {
        const response = await axios.post('https://slack.com/api/auth.test', {},{
            
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        if (response.data.ok) {
            console.log('Bot ID:', response.data.user_id);
            return response.data.user_id; 
        } else {
            console.error('Slack API Error:', response.data.error);
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch bot ID');
    }
}
module.exports = {getToken, getChatHistory, postEphemeral, requestOllama, getChannelData, retrieveChatMessagesByChannel, getBotID, storeChatMessages};