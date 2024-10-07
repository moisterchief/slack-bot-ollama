# Project Setup

## Quick Start

0. **Initializing a new project:**

    ```bash
    #ignore this please its just so I dont forget
    npm init -y
    ```

1. **Install the required dependencies:**

    ```bash
    npm install
    ```

2. **Start your Node.js application with the environment variables from the `.env` file:**

    ```bash
    #old
    node --env-file=.env app.js

    #using dotenv
    node app.js
    ```

3. **Expose your local server using ngrok:**

    ```bash
    ngrok http 3000
    ```

4. **Run the Ollama model:**

    ```bash
    ollama run llama3.1
    ```

---

## Configuration Changes

### Updating URLs and OAuth Details:

When generating a new ngrok URL, make sure to update the following:

- **Event Subscription** URL (https://api.slack.com/apps/{app id}/event-subscriptions?) /endpoint
- **ENV file** HOST_URL
- **Slash Command** URL (https://api.slack.com/apps/{app id}/slash-commands?) /summarise, /suggest, /ask
- **OAuth & Permissions** Redirect URL (https://api.slack.com/apps/{app id}/oauth) /oauth-redirect


Additionally, if you modify the bot permissions, ensure that the static HTML `add` button is updated accordingly.

`public/index.html`

---

## `.env` File

Your `.env` file should contain these environment variables and be at the top level of your file structure:

```bash
TOKEN=xoxb-***************************
OLLAMA_URL=http://localhost:11434/api/chat
MODEL=llama3.1
PORT=3000
HOST_URL=https://***************.ngrok-free.app
CLIENT_ID=******************************
CLIENT_SECRET=*********************************
