const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

// Open the database connection
const db = new sqlite3.Database('./slack_messages.db', sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
});

// Promisify the db.run and db.get methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Initialize the database and create necessary indexes for a team-specific table
async function createIndexesForTeam(team_id) {
    const tableName = `messages_${team_id}`;
    try {
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_channel_id ON ${tableName}(channel_id);`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_timestamp ON ${tableName}(timestamp);`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_user_id ON ${tableName}(user_id);`);
        // console.log(`Indexes created for team ${team_id}`);
    } catch (err) {
        console.error(`Error creating indexes for team ${team_id}:`, err.message);
    }
}
//TODO: separate db's for each team_id cause currently this is retarded

// Function to create the table (if not already created)
async function createTableForTeam(team_id) {
    const tableName = `messages_${team_id}`;
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (
        timestamp TEXT PRIMARY KEY,
        team_id TEXT,
        channel_id TEXT,
        username TEXT,
        user_id TEXT,
        message_text TEXT
    )`;
    try {
        await dbRun(sql);
        await createIndexesForTeam(team_id);
        // console.log('Table created successfully');
    } catch (err) {
        console.error('Error creating table:', err.message);
    }
}

// Function to insert a message into the database
async function insertMessage(timestamp, team_id, channel_id, username, user_id, message_text) {
    const tableName = `messages_${team_id}`;
    const sql = `INSERT OR IGNORE INTO ${tableName} (timestamp, team_id, channel_id, username, user_id, message_text)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    try {
        await createTableForTeam(team_id);
        await dbRun(sql, [timestamp, team_id, channel_id, username, user_id, message_text]);
        console.log(`Message inserted for ${team_id} with: ${timestamp} ${team_id} ${channel_id} ${username} ${user_id} ${message_text}`);
    } catch (error) {
        console.error(`Failed to insert message into ${team_id}:`, error.message);
    }
}

// Function to get messages from a specific channel
async function getMessagesByChannel(team_id, channel_id, limit) {
    const tableName = `messages_${team_id}`
    const sql = `SELECT * FROM ${tableName} WHERE channel_id = ? ORDER BY timestamp ASC LIMIT ?`;
    try {
        const rows = await dbAll(sql, [channel_id, limit]);
        return rows;
    } catch (err) {
        console.error('Error fetching messages:', err.message);
        throw err;
    }
}

async function getChannelsForTeam(team_id) {
    const tableName = `messages_${team_id}`
    const sql = `SELECT DISTINCT channel_id FROM ${tableName}`; // SQL query to get unique channel IDs
    try {
        const rows = await dbAll(sql); 
        const channelIds = rows.map(row => row.channel_id); // Extract the channel_id from each row
        return channelIds; 
    } catch (err) {
        console.error('Error fetching unique channel IDs:', err.message);
        throw err;
    }
}

/**
 * From scott with love
 * @param {*} team_id 
 * @param {*} channel_id 
 */
async function getMessageStatistics(team_id, channel_id) {
    try {
        // Fetch messages for the channel
        const messages = await getMessagesByChannel(team_id, channel_id, 999);

        // Define skipped words and convert to a Set for faster lookups
        const skippedWords = new Set([
            "the", "a", "an", "and", "or", "but", "if", "you", "me", "we", "he", "she", "it", "they", 
            "them", "us", "is", "are", "was", "were", "be", "been", "this", "that", "in", "on", "at", 
            "with", "for", "to", "of", "by", "as", "i", "*"
        ]);

        const wordCounts = new Map();
        const userMessageCounts = new Map();

        // Process each message
        messages.forEach((message) => {
            // Track message count per user
            userMessageCounts.set(
                message.username,
                (userMessageCounts.get(message.username) || 0) + 1
            );

            // Split the message into words, filter out skipped words, and count them
            const words = message.message_text
                .toLowerCase() // Convert to lowercase for consistent counting
                .split(/\s+/)  // Split by any whitespace
                .filter((word) => word && !skippedWords.has(word));

            words.forEach((word) => {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            });
        });

        // Sort users by message count
        const sortedUsers = [...userMessageCounts.entries()].sort((a, b) => b[1] - a[1]);

        // Sort words by count and get the top 5
        const topWords = [...wordCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Prepare the output
        let output = `*In this channel:*\n\n`;
        sortedUsers.forEach(([userId, count]) => {
            output += `${userId}: ${count} messages\n`;
        });

        output += "\n*Top 5 Most Used Words:*\n\n";
        topWords.forEach(([word, count], index) => {
            output += `${index + 1}. ${word}: ${count} occurrences\n`;
        });

        return output;
    } catch (error) {
        console.error(`Error generating statistics for team ${team_id}, channel ${channel_id}:`, error.message);
        throw error;
    }
}

// Close the database connection on process exit
process.on('exit', () => {
    db.close((err) => {
        if (err) console.error('Error closing the database:', err.message);
    });
});


module.exports = { insertMessage, getMessagesByChannel, getChannelsForTeam, getMessageStatistics};
