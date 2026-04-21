const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const VALID_ROLES = new Set(['interviewee', 'recruiter']);

const createToken = (user) => {
  const secret = process.env.JWT_SECRET || 'change_me';
  return jwt.sign({ userId: user._id }, secret, { expiresIn: '7d' });
};

const serializeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role || 'interviewee',
});

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const normalizedRole = VALID_ROLES.has(role) ? role : 'interviewee';
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: normalizedRole,
    });
    const token = createToken(user);

    return res.json({ user: serializeUser(user), token });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ error: `This account is registered as a ${user.role}. Please use the correct portal.` });
    }

    const token = createToken(user);
    return res.json({ user: serializeUser(user), token });
  } catch (error) {
    next(error);
  }
};
