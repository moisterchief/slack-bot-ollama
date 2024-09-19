const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

// Open the database connection
const db = new sqlite3.Database('./channels.db', sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
});

// Promisify the db.run and db.get methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));

// Function to create the table (if not already created)
async function createTable() {
    const sql = `CREATE TABLE IF NOT EXISTS channels (
        team_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL
    )`;
    try {
        await dbRun(sql);
        console.log('Table created successfully');
    } catch (err) {
        console.error('Error creating table:', err.message);
    }
}

// Function to insert a channel
async function insertChannel(team_id, access_token) {
    // Check if the team_id already exists in the database
    const selectSql = `SELECT COUNT(*) as count FROM channels WHERE team_id = ?`;
    const updateSql = `UPDATE channels SET access_token = ? WHERE team_id = ?`;
    const insertSql = `INSERT INTO channels (team_id, access_token) VALUES (?, ?)`;

    try {
        const result = await dbGet(selectSql, [team_id]);
        if (result.count > 0) {
            await dbRun(updateSql, [access_token, team_id]);
            console.log(`Updated access_token for team_id: ${team_id}`);
        } else {
            // If the team_id does not exist, insert a new row
            const insertResult = await dbRun(insertSql, [team_id, access_token]);
            console.log('Inserted new row with team_id:', team_id);
            return insertResult.lastID; // Provide the last inserted row ID
        }
    } catch (err) {
        console.error('Error inserting or updating data:', err.message);
        throw err;
    }
}

// Function to get a channel by team_id
async function getChannelByTeamId(team_id) {
    const sql = `SELECT * FROM channels WHERE team_id = ?`;
    try {
        const row = await dbGet(sql, [team_id]);
        return row;
    } catch (err) {
        console.error('Error fetching data:', err.message);
        throw err;
    }
}

// createTable();

// Close the database connection on process exit
process.on('exit', () => {
    db.close((err) => {
        if (err) console.error('Error closing the database:', err.message);
    });
});

module.exports = { insertChannel, getChannelByTeamId };
