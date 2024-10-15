const { getChatMessages } = require('./slack_requests');

/**
 * From scott with love
 * @param {*} team_id 
 * @param {*} channel_id 
 */
async function getMessageStatistics(channel_id, token) {
    try {
        const messages = await getChatMessages(channel_id, 999, token);

        const skippedWords = new Set([
            "the", "a", "an", "and", "or", "but", "if", "you", "me", "we", "he", "she", "it", "they", 
            "them", "us", "is", "are", "was", "were", "be", "been", "this", "that", "in", "on", "at", 
            "with", "for", "to", "of", "by", "as", "i", "*"
        ]);

        const wordCounts = new Map();
        const userMessageCounts = new Map();

        messages.forEach((message) => {
            userMessageCounts.set(
                message.username,
                (userMessageCounts.get(message.username) || 0) + 1
            );

            const words = message.text
                .toLowerCase() 
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
        console.error('Error generating statistics');
        throw error;
    }
}

module.exports = { getMessageStatistics };
