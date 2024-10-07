const { getMessagesByChannel } = require('./messages_db')
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


module.exports = { getChannelMessagesAsString };
