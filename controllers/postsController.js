const Post = require('../models/Post');
const Community = require('../models/Community');

// Create a new post in a community
exports.createPost = async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.user.id;

    // Verify community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    // Verify user is a member
    if (!community.members.includes(userId)) {
      return res.status(403).json({ message: 'You must be a member to post in this community' });
    }

    const {
      title,
      content,
      contentWarning,
      contentWarningText,
      anonymous,
      flair,
      media,
    } = req.body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Post title is required' });
    }
    if (title.length > 150) {
      return res.status(400).json({ message: 'Title cannot exceed 150 characters' });
    }
    if (contentWarning && (!contentWarningText || contentWarningText.trim().length === 0)) {
      return res.status(400).json({ message: 'Content warning text is required when enabled' });
    }

    const newPost = new Post({
      community: communityId,
      author: userId,
      title: title.trim(),
      content: content || '',
      contentWarning: !!contentWarning,
      contentWarningText: contentWarning ? contentWarningText.trim() : '',
      anonymous: !!anonymous,
      flair: flair || '',
      media: Array.isArray(media) ? media : [],
    });

    await newPost.save();
    // Populate author for response
    await newPost.populate('author', 'firstName lastName profilePicture');

    res.status(201).json(newPost);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get posts for a community
exports.getPostsByCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
    // Verify community exists and user access
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    const userId = req.user.id;
    // Only members or community creator expert can view
    if (!community.members.includes(userId) && community.creator.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view posts' });
    }
    // Fetch posts with author, comments, and nested replies author populated
    // Fetch posts with recursive population for comments and two levels of replies
    const posts = await Post.find({ community: communityId })
      .sort({ createdAt: -1 })
      .populate('author', 'firstName lastName profilePicture')
      .populate({
        path: 'comments',
        populate: [
          { path: 'author', select: 'firstName lastName profilePicture' },
          {
            path: 'replies',
            populate: [
              { path: 'author', select: 'firstName lastName profilePicture' },
              {
                path: 'replies',
                populate: [
                  { path: 'author', select: 'firstName lastName profilePicture' },
                  {
                    path: 'replies',
                    populate: { path: 'author', select: 'firstName lastName profilePicture' }
                  }
                ]
              }
            ]
          }
        ]
      });
    // Add vote counts for clarity
    const result = posts.map(post => ({
      _id: post._id,
      community: post.community,
      author: post.author,
      title: post.title,
      content: post.content,
      contentWarning: post.contentWarning,
      contentWarningText: post.contentWarningText,
      anonymous: post.anonymous,
      flair: post.flair,
      media: post.media,
      createdAt: post.createdAt,
      comments: post.comments,
      upvoteCount: post.upvotes.length,
      downvoteCount: post.downvotes.length,
    }));
    res.status(200).json(result);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Vote on a post (upvote/downvote)
exports.votePost = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const { voteType } = req.body; // 'upvote' or 'downvote'
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    // check community membership
    const community = await Community.findById(post.community);
    if (!community.members.includes(userId) || post.author.toString() === userId) {
      return res.status(403).json({ message: 'Not authorized to vote' });
    }
    // remove existing votes
    post.upvotes = post.upvotes.filter(id => id.toString() !== userId);
    post.downvotes = post.downvotes.filter(id => id.toString() !== userId);
    if (voteType === 'upvote') post.upvotes.push(userId);
    if (voteType === 'downvote') post.downvotes.push(userId);
    await post.save();
    res.status(200).json({ upvotes: post.upvotes.length, downvotes: post.downvotes.length });
  } catch (error) {
    console.error('Vote post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const { content } = req.body;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const community = await Community.findById(post.community);
    if (!community.members.includes(userId) && community.creator.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to comment' });
    }
    post.comments.push({ author: userId, content });
    await post.save();
    // Populate author and nested replies authors
    await post.populate([
      { path: 'comments.author', select: 'firstName lastName profilePicture' },
      { path: 'comments.replies.author', select: 'firstName lastName profilePicture' }
    ]);
    res.status(201).json(post.comments);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a reply to a comment
exports.addReply = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const community = await Community.findById(post.community);
    if (!community) return res.status(404).json({ message: 'Community not found' });
    // Only members or community creator can reply
    if (!community.members.includes(userId) && community.creator.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to reply' });
    }
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    comment.replies.push({ author: userId, content });
    await post.save();
    // Populate comment author and nested reply authors
    await post.populate({
      path: 'comments',
      populate: [
        { path: 'author', select: 'firstName lastName profilePicture' },
        {
          path: 'replies',
          populate: { path: 'author', select: 'firstName lastName profilePicture' }
        }
      ]
    });
    // Return updated comment with populated authors
    const updatedComment = post.comments.id(commentId).toObject();
    res.status(201).json(updatedComment);
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// Add a nested reply to an existing reply
exports.addReplyToReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    // Find post and validate access
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    const community = await Community.findById(post.community);
    if (!community) return res.status(404).json({ message: 'Community not found' });
    
    if (!community.members.includes(userId) && community.creator.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to reply' });
    }
    
    // Find the comment
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    
    // Find the parent reply using a recursive function
    const findReplyById = (replyArray, targetId) => {
      if (!replyArray || replyArray.length === 0) return null;
      
      for (const reply of replyArray) {
        if (reply._id.toString() === targetId) {
          return reply;
        }
        
        // Check nested replies
        const nestedResult = findReplyById(reply.replies, targetId);
        if (nestedResult) return nestedResult;
      }
      
      return null;
    };
    
    // Search for the reply at any nesting level
    const parentReply = findReplyById(comment.replies, replyId);
    
    if (!parentReply) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    
    // Add the new reply to the parent reply
    parentReply.replies.push({ author: userId, content });
    await post.save();
    
    // Populate nested authors up to three levels
    await post.populate({
      path: 'comments',
      populate: [
        { path: 'author', select: 'firstName lastName profilePicture' },
        {
          path: 'replies',
          populate: [
            { path: 'author', select: 'firstName lastName profilePicture' },
            {
              path: 'replies',
              populate: [
                { path: 'author', select: 'firstName lastName profilePicture' },
                {
                  path: 'replies',
                  populate: { path: 'author', select: 'firstName lastName profilePicture' }
                }
              ]
            }
          ]
        }
      ]
    });
    
    // Find the updated reply (might be at any nesting level)
    const updatedReply = findReplyById(comment.replies, replyId);
    res.status(201).json(updatedReply);
  } catch (error) {
    console.error('Add nested reply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
