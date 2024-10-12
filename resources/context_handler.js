const {getToken, getBotID, getName } = require('./slack_requests')
const { getChannelsForTeam, insertMessage, getMessagesByChannel } = require('./messages_db');
const { requestOllama } = require('./ollama_handler');
const fs = require('fs').promises;
const axios = require('axios');

async function getChannelMessagesAsStringWithUsername(team_id, channel_id, limit) {
    rows = await getMessagesByChannel(team_id, channel_id, limit);
    const context = rows.map(row => `${row.username}: ${row.message_text}`).join('\n');

    const filePath = `./channel_${team_id}_${channel_id}_messages.txt`;

    try {
        await fs.writeFile(filePath, context, 'utf8');
        console.log(`Context has been written to ${filePath}`);
    } catch (error) {
        console.error('Error writing to file:', error);
    }
    return context;
}


async function addNewChannelData(event) {
    const { user: joined_user, channel: channel, team: team} = event;
    const token = await getToken(team);
    const bot_id = await getBotID(token);

    if (joined_user === bot_id) {
        storeChatMessages(channel, team, 999, token);
    }
}

async function checkIfShouldAddMessage(message) {
    const prompt = `_________________________________________________________________\n\n\
    IS THIS MESSAGE WORTH STORING IN A SLACK MESSAGE DATABASE?\n\n\
    RESPOND IN YES or NO ONLY`;
    
    try {
        const context = `THIS IS A MESSAGE IN A SLACK CHANNEL: \n\n ${message}`;
        const response = await requestOllama(prompt, context);
        console.log("OLLAMA HAS DECIDED: " + response);
        return response.toLowerCase().includes('yes');
    } catch (error) {
        console.error('Error requesting Ollama:', error);
        return false; // Default to not storing if there's an error with the request
    }
}

async function addMessage(event) {
    // console.log(apiPostBody);
    const { channel: channel_id, user: user_id, text, ts: timestamp, team: team_id } = event;

    if (!(await checkIfShouldAddMessage(text))) {
        return;
    }

    const token = await getToken(team_id);
    const username = await getName(user_id, token);
    const channels = await getChannelsForTeam(team_id);

    if (channels.includes(channel_id)) {
        // if (message_text.includes('??')) {
        //     await handleQuestion(team_id, channel_id, user_id, username, text, token);
        // }
        await insertMessage(timestamp, team_id, channel_id, username, user_id, text);
    }
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
            if (response.data.ok) {
                for (const message of response.data.messages) {
                    const userName = await getName(message.user, token);
    
                    if (await checkIfShouldAddMessage(message.text)) {
                        await insertMessage(message.ts, team_id, channel_id, userName, message.user, message.text);
                    }
                }
            } else {
                // throw new Error(`Slack API Error: ${response.data.error}`);
                console.log('not in channel', response.data);
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch chat history');
    }
}


module.exports = { getChannelMessagesAsStringWithUsername, addMessage, addNewChannelData , storeChatMessages};
