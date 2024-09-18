npm init -y <br>
npm install <br>
node app.js <br>
ngrok http 3000 <br>
ollama run llama3.1 <br>

to run:
npm install
node --env-file=.env app.js

change ngrok url in event subscription, slash command when generating a new url and Oauth & permissions redirect URL if changing bot perms update static html 'add' button

env file contains:
TOKEN=xoxb-***************************
OLLAMA_URL=http://localhost:11434/api/chat
MODEL=llama3.1
PORT=3000
HOST_URL=https://***************.ngrok-free.app
CLIENT_ID=******************************
CLIENT_SECRET=*********************************

Useful links:
https://github.com/ollama/ollama/tree/main/docs <br>
https://ngrok.com/ <br>
