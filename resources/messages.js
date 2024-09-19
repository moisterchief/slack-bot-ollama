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

// Function to create indexes this is for better performance 
async function createIndexes() {
    try {
        // Index on channel_id
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_channel_id ON messages(channel_id);`);
        console.log('Index on channel_id created successfully');
        
        // Index on timestamp
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);`);
        console.log('Index on timestamp created successfully');
        
        // Optional: Index on user_id
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_user_id ON messages(user_id);`);
        console.log('Index on user_id created successfully');
    } catch (err) {
        console.error('Error creating indexes:', err.message);
    }
}

// Function to create the table (if not already created)
async function createTable() {
    const sql = `CREATE TABLE IF NOT EXISTS messages (
        timestamp TEXT PRIMARY KEY,
        team_id TEXT,
        channel_id TEXT,
        username TEXT,
        user_id TEXT,
        message_text TEXT
    )`;
    try {
        await dbRun(sql);
        console.log('Table created successfully');
    } catch (err) {
        console.error('Error creating table:', err.message);
    }
}

// Function to insert a message into the database
async function insertMessage(timestamp, team_id, channel_id, username, user_id, message_text) {
    const sql = `INSERT OR IGNORE INTO messages (timestamp, team_id, channel_id, username, user_id, message_text) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    try {
        await dbRun(sql, [timestamp, team_id, channel_id, username, user_id, message_text]);
        console.log(`Message inserted for timestamp: ${timestamp, team_id, channel_id, username, user_id, message_text}`);
    } catch (error) {
        console.error('Failed to insert message:', error.message);
        console.log(timestamp, team_id, channel_id, username, user_id, message_text);
    }
}

// Function to get messages from a specific channel
async function getMessagesByChannel(channel_id, limit) {
    const sql = `SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp ASC LIMIT ?`;
    try {
        const rows = await dbAll(sql, [channel_id, limit]);
        return rows;
    } catch (err) {
        console.error('Error fetching messages:', err.message);
        throw err;
    }
}

async function getChannels() {
    const sql = `SELECT DISTINCT channel_id FROM messages`; // SQL query to get unique channel IDs
    try {
        const rows = await dbAll(sql); 
        const channelIds = rows.map(row => row.channel_id); // Extract the channel_id from each row
        return channelIds; 
    } catch (err) {
        console.error('Error fetching unique channel IDs:', err.message);
        throw err;
    }
}

// Call the function to create the table and indexes
async function initializeDatabase() {
    await createTable();
    await createIndexes();
};

initializeDatabase();

// Close the database connection on process exit
process.on('exit', () => {
    db.close((err) => {
        if (err) console.error('Error closing the database:', err.message);
    });
});


module.exports = { insertMessage, getMessagesByChannel, initializeDatabase, getChannels};
