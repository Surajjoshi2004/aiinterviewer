const { evaluateTranscript } = require('../services/aiService');

exports.evaluationController = async (req, res, next) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'transcript is required' });
    }

    const evaluation = await evaluateTranscript(transcript);
    return res.json({ evaluation });
  } catch (error) {
    next(error);
  }
};
