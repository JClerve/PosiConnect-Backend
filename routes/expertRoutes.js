const express = require('express');
const router = express.Router();
const expertController = require('../controllers/expertController');

// Route to get all experts
router.get('/', expertController.getExperts);

module.exports = router;
