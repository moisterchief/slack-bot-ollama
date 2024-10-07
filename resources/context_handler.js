const { insertChannel, getChannelByTeamId } = require('./token_db');
const {getToken, getChatHistory, postEphemeral, getChannelData, getBotID, storeChatMessages, getName, postMessage} = require('./slack_requests')
const { getChannelsForTeam, insertMessage, getMessagesByChannel } = require('./messages_db');
const { requestOllama } = require('./ollama_handler');
const fs = require('fs').promises;

async function getChannelMessagesAsString(team_id, channel_id) {
    rows = await getMessagesByChannel(team_id, channel_id, 999);
    const context = rows.map(row => row.message_text).join('\n');
        // Define the file path where you want to store the context
    const filePath = `./channel_${team_id}_${channel_id}_messages.txt`;

    try {
        // Write the context to the file
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

async function addMessage(event) {
    // console.log(apiPostBody);
    const { channel: channel_id, user: user_id, text, ts: timestamp, team: team_id } = event;
    const token = await getToken(team_id);
    const bot_id = await getBotID(token);
    const username = await getName(user_id, token);
    if (user_id !== bot_id) {
        
        const message_text = `${username}: ${text}`;

        const channels = await getChannelsForTeam(team_id);
        if (channels.includes(channel_id)) {
            // if (message_text.includes('??')) {
            //     await handleQuestion(team_id, channel_id, user_id, username, text, token);
            // }
            await insertMessage(timestamp, team_id, channel_id, username, user_id, message_text);
        }
    }
    else{
        await insertMessage(timestamp, team_id, channel_id, username, user_id, `(BOT) YOU REPLIED: ${text}`); 
    }
}


module.exports = { getChannelMessagesAsString, addMessage, addNewChannelData };
