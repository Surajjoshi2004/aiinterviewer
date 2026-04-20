const Interview = require('../models/interviewModel');

exports.createInterview = async (req, res, next) => {
  try {
    const { candidateName, transcript, evaluation } = req.body;
    if (!candidateName || !transcript || !evaluation) {
      return res.status(400).json({ error: 'candidateName, transcript, and evaluation are required' });
    }

    const interview = await Interview.create({
      user: req.user.id,
      candidateName: candidateName.trim(),
      transcript: transcript.trim(),
      evaluation,
    });

    res.status(201).json({ interview });
  } catch (error) {
    next(error);
  }
};

exports.getInterviews = async (req, res, next) => {
  try {
    const interviews = await Interview.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ interviews });
  } catch (error) {
    next(error);
  }
};
