const axios = require('axios');
const { getChannelByTeamId } = require('./token_db');
require('dotenv').config({ path: './.env' });

async function getToken(team_id) {
    try {
        const row = await getChannelByTeamId(team_id);
        return row.access_token;
    } catch (err) {
        console.error(err.message);
        throw new Error('Failed to retrieve access token');
    }
}

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
                    return `${userName}: ${message.text || ''}`;
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

async function getChatMessages(channel_id, limit, token) {
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
                    return {
                        text: message.text || '', // Message text
                        username: userName,       // Username of the sender
                        timestamp: message.ts,   // Timestamp of the message
                        user_id: message.user    // User ID of the sender
                    };
                })
            );

            return messages; // Return the array of message objects
        } else {
            throw new Error(`Slack API Error: ${response.data.error}`);
        }
    } catch (error) {
        console.error('Error fetching chat messages:', error.message);
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

async function getThreadMessages(channel, ts, token) {
    try {
        const response = await axios.get('https://slack.com/api/conversations.replies', {
            params: {
                channel: channel,
                ts: ts
            },
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
        if (response.data.ok) {
            return response.data;
        } 
        else {
            throw new Error(`Slack API Error: ${response.data.error}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch channels');
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
        console.log('Ephemeral Sent');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function postMessage(channel_id, text, token) {
    try {
        await axios.post('https://slack.com/api/chat.postMessage', {
            channel: channel_id,
            text: text
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
        console.log('Post Message Sent');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function postThreadedReply(channel_id, text, ts, token) {
    try {
        await axios.post('https://slack.com/api/chat.postMessage', {
            channel: channel_id,
            text: text,
            thread_ts: ts
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
        console.log('Thread Reply Sent');
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
            return response.data.user_id; 
        } else {
            console.error('Slack API Error:', response.data.error);
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch bot ID');
    }
}
module.exports = {getToken, getChatHistory, postEphemeral, getBotID, getName, postMessage, getThreadMessages, postThreadedReply, getChatMessages};