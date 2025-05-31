# EmotionScore AI

An advanced emotion-intelligent chatbot with comprehensive multimodal interaction capabilities, enhanced with seamless voice call integration using ElevenLabs AI technology.

## Features

- 🧠 **Emotional Intelligence**: VAD (Valence-Arousal-Dominance) emotional analysis
- 🎙️ **Voice Conversations**: ElevenLabs AI voice integration with live transcription
- 💬 **Text Style Matching**: Adapts to user's communication style
- 🔍 **Echo-Enhanced Search**: Real-time web search with citations
- 📊 **Visualization Support**: ASCII/Unicode diagrams and charts
- 🎨 **Modern UI**: Glassmorphism design with Space Grotesk typography

## Tech Stack

- **Frontend**: React (TypeScript), Tailwind CSS, Framer Motion
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini API, ElevenLabs Voice AI
- **Styling**: Tailwind CSS, Space Grotesk font

## Environment Variables

Create a `.env` file with the following variables:

```env
# Google Gemini API
GOOGLE_API_KEY=your_google_api_key

# ElevenLabs Voice AI
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_agent_id

# Database
DATABASE_URL=your_postgresql_database_url

# Optional: Google Search (for Echo-Enhanced mode)
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/emotionscore.git
cd emotionscore
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see above)

4. Run the development server:
```bash
npm run dev
```

## Deployment to Railway (Recommended)

### Prerequisites
- GitHub account
- Railway account (free at railway.app)
- Required API keys (Google Gemini, ElevenLabs)

### Steps

1. **Push to GitHub**:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/emotionscore.git
git push -u origin main
```

2. **Deploy to Railway**:
   - Go to [railway.app](https://railway.app) and sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your EmotionScore repository
   - Add PostgreSQL database (one click)

3. **Configure Environment Variables**:
   Add these in Railway dashboard:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID`
   - `GOOGLE_API_KEY`
   - `NODE_ENV=production`

4. **Database Setup**:
   Run `npm run db:push` in Railway terminal after deployment

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## API Documentation

### Chat Endpoints
- `GET /api/chats` - Get user's chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id/messages` - Get chat messages
- `POST /api/chats/:id/messages` - Send message

### User Endpoints
- `GET /api/user` - Get current user
- `POST /api/user/preferences` - Update user preferences

## Features Overview

### Emotional Intelligence
The system analyzes text using VAD dimensions:
- **Valence**: Positive/negative emotional state
- **Arousal**: Energy/activation level
- **Dominance**: Control/confidence level

### Voice Integration
- Real-time voice conversations via ElevenLabs
- Live transcription
- Emotional context-aware voice responses
- Multiple voice avatar options

### Style Matching
- Mirrors user's capitalization patterns
- Adapts to tone and formality level
- Matches punctuation and rhythm
- Responds to casual greetings appropriately

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details