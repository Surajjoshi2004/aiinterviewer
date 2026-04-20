const { chatResponse } = require('../services/aiService');

exports.chatController = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || !Array.isArray(history)) {
      return res.status(400).json({ error: 'message and history are required' });
    }

    const reply = await chatResponse(message, history);
    return res.json({ reply });
  } catch (error) {
    next(error);
  }
};
