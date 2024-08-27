const sqlite3 = require('sqlite3').verbose();


const db = new sqlite3.Database('./channels.db', sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
});

// let sql = `CREATE TABLE channels(
//     team_id TEXT PRIMARY KEY,
//     access_token TEXT NOT NULL
// )`;
// db.run(sql, (err) => {
//     if (err) return console.error(err.message);
//     console.log('Table created successfully');
// });

function insertChannel(team_id, access_token, callback) {
    const sql = `INSERT INTO channels (team_id, access_token) VALUES (?, ?)`;
    
    db.run(sql, [team_id, access_token], function (err) {
        if (err) {
            console.error('Error inserting data:', err.message);
            return callback(err);
        }

        console.log('Inserted row with team_id:', team_id);
        callback(null, this.lastID); // Provide the last inserted row ID
    });
}

function getChannelByTeamId(team_id, callback) {
    const sql = `SELECT * FROM channels WHERE team_id = ?`;
    db.get(sql, [team_id], (err, row) => {
        if (err) {
            console.error('Error fetching data:', err.message);
            return callback(err);
        }
        callback(null, row);
    });
}

process.on('exit', () => {
    db.close((err) => {
        if (err) console.error('Error closing the database:', err.message);
    });
});


module.exports = {insertChannel, getChannelByTeamId};