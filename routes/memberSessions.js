const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const memberSessionsController = require("../controllers/memberSessionsController");

// GET upcoming sessions for member's joined communities
router.get("/upcoming", protect, memberSessionsController.getUpcomingForMember);

// POST join a session (only for members of the community)
router.post("/:id/join", protect, memberSessionsController.joinSession);

module.exports = router;
