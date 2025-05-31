# EmotionScore Deployment Guide

## Railway Deployment (Recommended Free Option)

### Prerequisites
- GitHub account
- Railway account (free at railway.app)

### Step 1: Prepare Repository
1. Create new GitHub repository
2. Upload your EmotionScore code (excluding node_modules)
3. Ensure .gitignore is properly configured

### Step 2: Railway Setup
1. Go to railway.app and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your EmotionScore repository
4. Railway will automatically detect it's a Node.js app

### Step 3: Add Database
1. In Railway dashboard, click "New" → "Database" → "PostgreSQL"
2. Railway will create a database and provide DATABASE_URL automatically

### Step 4: Configure Environment Variables
In Railway dashboard, go to Variables tab and add:
```
NODE_ENV=production
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_AGENT_ID=your_agent_id
GOOGLE_API_KEY=your_google_key
```

### Step 5: Deploy
1. Railway automatically deploys on every git push
2. First deployment takes 3-5 minutes
3. You'll get a live URL like: https://your-app.railway.app

### Step 6: Database Migration
After first deployment:
1. Go to Railway dashboard
2. Open your app's terminal
3. Run: `npm run db:push`

## Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection (auto-provided by Railway) | Yes |
| ELEVENLABS_API_KEY | ElevenLabs API key for voice features | Yes |
| ELEVENLABS_AGENT_ID | ElevenLabs agent ID | Yes |
| GOOGLE_API_KEY | Google API for enhanced search features | Optional |

## Post-Deployment Checklist
- [ ] App loads successfully
- [ ] Database connection works
- [ ] Voice features work with ElevenLabs
- [ ] Custom prompts save properly
- [ ] Chat history persists

## Troubleshooting
- **Build fails**: Check package.json scripts are correct
- **Database issues**: Verify DATABASE_URL is set
- **Voice not working**: Check ElevenLabs credentials
- **App crashes**: Check Railway logs in dashboard