const express = require('express');
const cors = require('cors');
require('./services/db');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/evaluate', evaluationRoutes);
app.use('/api/interviews', interviewRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'AI Tutor Screener backend is alive' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const response = {
    error: err.message || 'Internal server error',
  };

  if (process.env.NODE_ENV !== 'production' && err.code) {
    response.code = err.code;
  }

  res.status(status).json(response);
});

module.exports = app;
