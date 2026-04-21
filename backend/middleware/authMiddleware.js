const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

exports.authMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role || 'interviewee' };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
