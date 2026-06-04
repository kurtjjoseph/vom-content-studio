# VOM Content Studio

AI-driven content generation for faith-based organisations. Supports Claude (Anthropic) and OpenAI. Generates tailored copy for Social Media, Email, SMS/WhatsApp, and Print â all in one click.

## Run locally

```bash
npm install
node server.js
```

Open http://localhost:3000

## Deploy to Railway

1. Push this folder to a GitHub repository
2. Go to [railway.app](https://railway.app) and click **New Project**
3. Select **Deploy from GitHub repo** and choose your repo
4. Railway detects Node.js automatically â no config needed
5. Click **Deploy** â your live URL appears in ~2 minutes

## Deploy to Render

1. Push to GitHub
2. Go to [render.com](https://render.com) â **New Web Service**
3. Connect your GitHub repo
4. Set **Start Command** to `node server.js`
5. Deploy

## Docker

```bash
docker build -t vom-content-studio .
docker run -p 3000:3000 vom-content-studio
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Port the server listens on |

API keys are entered by the user in the browser â they are never stored server-side.
