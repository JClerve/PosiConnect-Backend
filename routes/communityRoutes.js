const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const communityController = require("../controllers/communityController");
// Require postsController to handle nested replies fallback
const postsController = require("../controllers/postsController");
const { protect, restrictTo } = require("../middleware/auth");

// Validation rules for community creation and update
const communityValidation = [
  body("name")
    .trim()
    .not().isEmpty().withMessage("Community name is required")
    .isLength({ max: 100 }).withMessage("Name cannot exceed 100 characters"),
  body("displayTitle")
    .trim()
    .not().isEmpty().withMessage("Display title is required")
    .isLength({ max: 100 }).withMessage("Display title cannot exceed 100 characters"),
  body("description")
    .trim()
    .not().isEmpty().withMessage("Description is required")
    .isLength({ max: 1000 }).withMessage("Description cannot exceed 1000 characters"),
  body("category")
    .trim()
    .not().isEmpty().withMessage("Category is required"),
  body("tags")
    .optional()
    .isArray().withMessage("Tags must be an array"),
  body("rules")
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage("Rules cannot exceed 2000 characters")
];

// Route: GET /api/communities
// Description: Get all communities
// Access: Public
router.get("/", communityController.getAllCommunities);

// Route: GET /api/communities/member
// Description: Get communities for a member (joined and available)
// Access: Private
// Member-specific route: requires authentication
router.get("/member", protect, communityController.getMemberCommunities);

// Route: POST /api/communities
// Description: Create a new community (experts only)
// Access: Private (Expert only)
router.post("/", protect, restrictTo('expert'), communityValidation, communityController.createCommunity);

// Route: GET /api/communities/:id
// Description: Get a specific community by ID
// Access: Public
router.get("/:id", communityController.getCommunityById);

// Route: POST /api/communities/:id/join
// Description: Request to join a community
// Access: Private (any authenticated user)
router.post("/:id/join", protect, communityController.requestToJoinCommunity);

// Route: POST /api/communities/:id/leave
// Description: Request to leave a community
// Access: Private (any authenticated user)
router.post("/:id/leave", protect, communityController.requestToLeaveCommunity);

// Route: POST /api/communities/:id/membership-requests/:requestId
// Description: Handle membership request (approve/reject)
// Access: Private (Expert/creator only)
router.post("/:id/membership-requests/:requestId", protect, restrictTo('expert'), communityController.handleMembershipRequest);

// Route: POST /api/communities/:id/exit-requests/:requestId
// Description: Handle exit request (approve/reject)
// Access: Private (Expert/creator only)
router.post("/:id/exit-requests/:requestId", protect, restrictTo('expert'), communityController.handleExitRequest);

// Route: GET /api/communities/:id/membership-requests
// Description: Get pending membership requests for a community
// Access: Private (Expert/creator only)
router.get("/:id/membership-requests", protect, restrictTo('expert'), communityController.getPendingMembershipRequests);

// Route: GET /api/communities/:id/exit-requests
// Description: Get pending exit requests for a community
// Access: Private (Expert/creator only)
router.get("/:id/exit-requests", protect, restrictTo('expert'), communityController.getPendingExitRequests);

// Route: GET /api/communities/:id/member-history
// Description: Get member history for a community
// Access: Private (Expert/creator only)
router.get("/:id/member-history", protect, restrictTo('expert'), communityController.getMemberHistory);

// Route: PUT /api/communities/:id
// Description: Update a community (creator only)
// Access: Private (Expert/creator only)
router.put("/:id", protect, restrictTo('expert'), communityValidation, communityController.updateCommunity);

// Route: DELETE /api/communities/:id
// Description: Delete a community (creator only)
// Access: Private (Expert/creator only)
router.delete("/:id", protect, restrictTo('expert'), communityController.deleteCommunity);

// Fallback route: reply to a comment in a post (in case postsRoutes misses it)
router.post('/:id/posts/:postId/comments/:commentId/replies', protect, postsController.addReply);

module.exports = router;
