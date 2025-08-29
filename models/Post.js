const mongoose = require('mongoose');

// Define a recursive schema for replies
const replySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, trim: true, required: true },
    createdAt: { type: Date, default: Date.now },
    replies: [] // will be added recursively
  },
  { _id: true }
);
// Allow nested replies within replies
replySchema.add({ replies: [replySchema] });

// Comment schema uses the same replySchema for nested replies
const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, trim: true, required: true },
    createdAt: { type: Date, default: Date.now },
    replies: [replySchema]
  },
  { _id: true }
);

// Main post schema
const postSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      trim: true,
    },
    contentWarning: {
      type: Boolean,
      default: false,
    },
    contentWarningText: {
      type: String,
      trim: true,
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
    flair: {
      type: String,
      trim: true,
    },
    media: [String],
    comments: [commentSchema],
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Index for faster querying by community
postSchema.index({ community: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
