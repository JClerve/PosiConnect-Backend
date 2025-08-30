const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
// const auth = require("../middleware/auth"); // enable if you use auth middleware

// Create session
router.post("/", /* auth, */ sessionController.createSession);

// List sessions
router.get("/", sessionController.getSessions);

// Get session by id
router.get("/:id", sessionController.getSessionById);

// Update session by id
router.put("/:id", /* auth, */ sessionController.updateSession);

module.exports = router;
