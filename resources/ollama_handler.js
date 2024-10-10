require('dotenv').config({ path: './.env' });
const axios = require('axios');

const ollamaURL = process.env.OLLAMA_URL;
const model = process.env.MODEL;


async function requestOllama(prompt, context) {
    try {
        const response = await axios.post(ollamaURL, {
            model: model,
            // options: {'num_ctx': 8192},
            messages: [{ role: 'user', content: context + prompt }],
            stream: false
        });

        const generatedText = response.data.message.content;
        return generatedText;
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to fetch data from Ollama API');
    }
}

module.exports = { requestOllama };