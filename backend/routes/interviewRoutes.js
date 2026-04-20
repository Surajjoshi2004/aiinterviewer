const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const interviewController = require('../controllers/interviewController');

router.use(authMiddleware);
router.post('/', interviewController.createInterview);
router.get('/', interviewController.getInterviews);

module.exports = router;
