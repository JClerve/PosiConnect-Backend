const express = require('express');
const router = express.Router({ mergeParams: true }); // mount under /api/communities/:id
const postsController = require('../controllers/postsController');
const { protect } = require('../middleware/auth');

// @route   POST /api/communities/:id/posts
router.post('/', protect, postsController.createPost);

// @route   GET /api/communities/:id/posts
router.get('/', protect, postsController.getPostsByCommunity);
// @route   POST /api/communities/:id/posts/:postId/vote
router.post('/:postId/vote', protect, postsController.votePost);
// @route   POST /api/communities/:id/posts/:postId/comments
router.post('/:postId/comments', protect, postsController.addComment);
// @route   POST /api/communities/:id/posts/:postId/comments/:commentId/replies
router.post('/:postId/comments/:commentId/replies', protect, postsController.addReply);
// Nested reply to a reply
router.post('/:postId/comments/:commentId/replies/:replyId/replies', protect, postsController.addReplyToReply);

module.exports = router;
