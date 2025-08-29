const mongoose = require("mongoose");

const membershipRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    nic: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    responseDate: {
      type: Date,
    },
  },
  { _id: true }
);

const exitRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    responseDate: {
      type: Date,
    },
  },
  { _id: true }
);

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Community name cannot exceed 100 characters"],
    },
    displayTitle: {
      type: String,
      required: [true, "Display title is required"],
      trim: true,
      maxlength: [100, "Display title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Community description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    rules: {
      type: String,
      trim: true,
      maxlength: [2000, "Rules cannot exceed 2000 characters"],
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    membershipRequests: [membershipRequestSchema],
    exitRequests: [exitRequestSchema],
    memberHistory: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      joinedAt: Date,
      leftAt: Date,
      reason: String,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes for faster querying
communitySchema.index({ name: 1 });
communitySchema.index({ category: 1 });
communitySchema.index({ tags: 1 });
communitySchema.index({ creator: 1 });

module.exports = mongoose.model("Community", communitySchema);
