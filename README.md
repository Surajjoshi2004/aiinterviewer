# AI Tutor Screener

An AI-powered interview platform for Cuemath tutor screening. The application uses OpenRouter/Google Gemini AI to conduct realistic mock interviews with voice interaction, real-time transcription, and automated evaluation.

## Live Demo

**Live URL:** https://aiinterviewer-chi.vercel.app/

## Features

- **Voice-Based Interviews** - Candidates interact with AI interviewer "Raj" using speech-to-text
- **Real-Time Responses** - AI generates natural follow-up questions based on answers
- **Transcript Display** - Full conversation transcript shown in real-time
- **Automated Evaluation** - AI evaluates candidate responses after the interview
- **Authentication** - User signup/login to save interview history
- **MongoDB Storage** - Interview transcripts and evaluations stored in database

## Tech Stack

### Frontend
- React 18
- Vite (build tool)
- Web Speech API (Speech Recognition & Synthesis)

### Backend
- Node.js
- Express.js
- MongoDB (Mongoose ODM)
- JWT Authentication
- Google Gemini AI

## Application Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERVIEW FLOW                                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  Start   │────▶│  Enter Name  │────▶│   Interview    │
│  Screen  │     │              │     │   Begins       │
└──────────┘     └──────────────┘     └────────┬────────┘
                                                │
                    ┌───────────────────────────┬┴───────────────────┐
                    │                           │                    │
                    ▼                           ▼                    ▼
          ┌─────────────────┐        ┌─────────────────┐    ┌─────────────────┐
          │   User Speaks   │        │   AI Responds   │    │   Evaluate      │
          │   Answer        │        │   & Ask Next    │    │   Results       │
          └────────┬────────┘        └────────┬────────┘    └────────┬────────┘
                   │                           │                    │
                   └───────────────────────────┼────────────────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │   Interview Ends    │
                                    │   (6 Questions)     │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │   Result Screen     │
                                    │   with Evaluation   │
                                    └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         API ENDPOINTS                                │
└─────────────────────────────────────────────────────────────────────┘

Authentication:
  POST /api/auth/register    - Register new user
  POST /api/auth/login       - User login
  GET  /api/auth/me          - Get current user

Interview:
  POST /api/chat             - Send message to AI (chat)
  POST /api/evaluate         - Get AI evaluation of transcript

Data:
  GET  /api/interviews       - Get user's interview history
  GET  /api/interviews/:id   - Get specific interview
```

## Project Structure

```
ai-tutor-screener/
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Interview.jsx    # Main interview component
│   │   │   ├── Result.jsx       # Results display
│   │   │   └── StartScreen.jsx  # Initial screen
│   │   ├── api.js               # API client
│   │   ├── App.jsx              # Main app component
│   │   ├── main.jsx             # Entry point
│   │   └── styles.css           # Global styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── backend/                     # Express backend
│   ├── controllers/
│   │   ├── authController.js    # Auth logic
│   │   ├── chatController.js    # Chat/AI logic
│   │   ├── evaluationController.js
│   │   └── interviewController.js
│   ├── middleware/
│   │   └── authMiddleware.js    # JWT verification
│   ├── models/
│   │   ├── interviewModel.js   # Interview schema
│   │   └── userModel.js        # User schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── evaluationRoutes.js
│   │   └── interviewRoutes.js
│   ├── services/
│   │   ├── aiService.js         # AI integration
│   │   └── db.js                # Database connection
│   ├── utils/
│   │   └── prompts.js           # AI prompts
│   ├── app.js                   # Express app
│   ├── server.js                # Server entry
│   ├── package.json
│   └── .env.example
│
├── .gitignore
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- OpenRouter API Key or Google Gemini API Key

### Backend Setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-tutor-screener
JWT_SECRET=your-jwt-secret-key
GEMINI_API_KEY=your-gemini-api-key
FRONTEND_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

Backend runs on `http://localhost:3000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### Production Build

```bash
# Frontend
cd frontend
npm run build
```

The built files are in `frontend/dist/`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `GEMINI_API_KEY` | Google Gemini API key |
| `FRONTEND_URL` | Frontend URL for CORS |

## Security Notes

- Never commit `.env` files or real secrets
- Keep API keys, database credentials, and JWT secrets only in local environment files or deployment secrets
- Rotate any key that has been exposed publicly

## License

MIT
