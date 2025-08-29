const Community = require("../models/Community");
const User = require("../models/User");
const { validationResult } = require("express-validator");
const sendEmail = require("../utils/email");

// Get all communities
exports.getAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find({ isActive: true })
      .populate("creator", "firstName lastName profilePicture")
      .sort({ createdAt: -1 });
    
    res.status(200).json(communities);
  } catch (error) {
    console.error("Get all communities error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get communities for a specific member
exports.getMemberCommunities = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find communities where user is a member
    const joinedCommunities = await Community.find({ 
      members: userId,
      isActive: true 
    })
    .populate("creator", "firstName lastName profilePicture")
    .sort({ createdAt: -1 });
    
    // Find communities where user is not a member
    const availableCommunities = await Community.find({ 
      members: { $ne: userId },
      isActive: true 
    })
    .populate("creator", "firstName lastName profilePicture")
    .sort({ createdAt: -1 });
    
    res.status(200).json({
      joinedCommunities,
      availableCommunities
    });
  } catch (error) {
    console.error("Get member communities error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create a new community (experts only)
exports.createCommunity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if user is an expert
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "expert") {
      return res.status(403).json({ message: "Only experts can create communities" });
    }

    const { name, displayTitle, description, category, tags, rules } = req.body;

    // Check if community with this name already exists
    const existingCommunity = await Community.findOne({ name });
    if (existingCommunity) {
      return res.status(400).json({ message: "Community with this name already exists" });
    }

    // Create new community
    const newCommunity = new Community({
      name,
      displayTitle,
      description,
      creator: req.user.id,
      category,
      tags: tags || [],
      rules: rules || "",
      members: [req.user.id], // Creator automatically becomes a member
    });

    await newCommunity.save();
    
    // Populate the creator field for response
    await newCommunity.populate("creator", "firstName lastName profilePicture");
    
    res.status(201).json(newCommunity);
  } catch (error) {
    console.error("Create community error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get a specific community by ID
exports.getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate("creator", "firstName lastName profilePicture")
      .populate("members", "firstName lastName profilePicture");
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    res.status(200).json(community);
  } catch (error) {
    console.error("Get community error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Request to join a community
exports.requestToJoinCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.user.id;
    const { reason, nic } = req.body;
    
    console.log("Join request received:", { communityId, userId });
    console.log("Request body:", req.body);
    
    if (!reason || !nic) {
      console.log("Missing required fields:", { reason, nic });
      return res.status(400).json({ message: "Reason and NIC are required" });
    }
    
    const community = await Community.findById(communityId);
    if (!community) {
      console.log("Community not found:", communityId);
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is already a member
    console.log("Community members:", community.members);
    console.log("User ID to check:", userId);
    
    // Convert ObjectId to string for proper comparison
    const memberIds = community.members.map(id => id.toString());
    console.log("Member IDs as strings:", memberIds);
    
    if (memberIds.includes(userId)) {
      console.log("User is already a member");
      return res.status(400).json({ message: "You are already a member of this community" });
    }
    
    // Check if user already has a pending request
    console.log("Checking pending requests...");
    console.log("Membership requests:", community.membershipRequests);
    
    // Check each request to see if the current user has a pending request
    let hasExistingRequest = false;
    community.membershipRequests.forEach(request => {
      console.log("Comparing request user:", request.user.toString(), "with userId:", userId);
      if (request.user.toString() === userId && request.status === "pending") {
        hasExistingRequest = true;
      }
    });
    
    if (hasExistingRequest) {
      console.log("User already has a pending request");
      return res.status(400).json({ message: "You already have a pending request to join this community" });
    }
    
    // Create a new membership request
    console.log("Creating new membership request");
    const newRequest = {
      user: userId,
      reason,
      nic,
      status: "pending",
      requestDate: new Date()
    };
    
    community.membershipRequests.push(newRequest);
    console.log("Added new request:", newRequest);
    
    await community.save();
    console.log("Saved community with new request");
    
    // Find the community expert to notify them
    const user = await User.findById(userId).select("firstName lastName email");
    const expert = await User.findById(community.creator).select("email");
    
    console.log("Sending email to expert:", expert.email);
    // Send email notification to the expert
    await sendEmail({
      email: expert.email,
      subject: "New Community Membership Request",
      message: `${user.firstName} ${user.lastName} has requested to join your community "${community.displayTitle}". Please review this request in your dashboard.`
    });
    
    console.log("Email sent, returning success response");
    res.status(200).json({ message: "Your request to join the community has been submitted and is pending approval" });
  } catch (error) {
    console.error("Join community request error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Request to leave a community
exports.requestToLeaveCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.user.id;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: "Reason for leaving is required" });
    }
    
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is a member
    if (!community.members.includes(userId)) {
      return res.status(400).json({ message: "You are not a member of this community" });
    }
    
    // Check if user is the creator (creator cannot leave)
    if (community.creator.toString() === userId) {
      return res.status(400).json({ message: "Community creator cannot leave the community" });
    }
    
    // Check if user already has a pending exit request
    const existingRequest = community.exitRequests.find(
      request => request.user.toString() === userId && request.status === "pending"
    );
    
    if (existingRequest) {
      return res.status(400).json({ message: "You already have a pending request to leave this community" });
    }
    
    // Create a new exit request
    community.exitRequests.push({
      user: userId,
      reason,
      status: "pending",
      requestDate: new Date()
    });
    
    await community.save();
    
    // Find the community expert to notify them
    const user = await User.findById(userId).select("firstName lastName email");
    const expert = await User.findById(community.creator).select("email");
    
    // Send email notification to the expert
    await sendEmail({
      email: expert.email,
      subject: "Community Exit Request",
      message: `${user.firstName} ${user.lastName} has requested to leave your community "${community.displayTitle}". Please review this request in your dashboard.`
    });
    
    res.status(200).json({ message: "Your request to leave the community has been submitted and is pending approval" });
  } catch (error) {
    console.error("Leave community request error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update community (expert/creator only)
exports.updateCommunity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const communityId = req.params.id;
    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is the creator
    if (community.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the creator can update this community" });
    }
    
    const { name, displayTitle, description, category, tags, rules } = req.body;
    
    // Check if new name is already taken by another community
    if (name && name !== community.name) {
      const existingCommunity = await Community.findOne({ name });
      if (existingCommunity) {
        return res.status(400).json({ message: "Community with this name already exists" });
      }
    }
    
    // Update fields
    if (name) community.name = name;
    if (displayTitle) community.displayTitle = displayTitle;
    if (description) community.description = description;
    if (category) community.category = category;
    if (tags) community.tags = tags;
    if (rules !== undefined) community.rules = rules;
    
    await community.save();
    
    res.status(200).json(community);
  } catch (error) {
    console.error("Update community error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete community (expert/creator only)
exports.deleteCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is the creator
    if (community.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the creator can delete this community" });
    }
    
    // Mark as inactive instead of hard delete
    community.isActive = false;
    await community.save();
    
    res.status(200).json({ message: "Community successfully deleted" });
  } catch (error) {
    console.error("Delete community error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Handle membership request (approve/reject)
exports.handleMembershipRequest = async (req, res) => {
  try {
    const communityId = req.params.id;
    const requestId = req.params.requestId;
    const { status } = req.body; // status can be "approved" or "rejected"
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is the creator/expert
    if (community.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the community expert can approve or reject membership requests" });
    }
    
    // Find the membership request
    const requestIndex = community.membershipRequests.findIndex(
      request => request._id.toString() === requestId
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({ message: "Membership request not found" });
    }
    
    const membershipRequest = community.membershipRequests[requestIndex];
    
    // If already processed
    if (membershipRequest.status !== "pending") {
      return res.status(400).json({ message: `This request has already been ${membershipRequest.status}` });
    }
    
    // Update request status
    membershipRequest.status = status;
    membershipRequest.responseDate = new Date();
    
    // If approved, add user to members
    if (status === "approved") {
      if (!community.members.includes(membershipRequest.user)) {
        community.members.push(membershipRequest.user);
      }
      
      // Add to member history
      community.memberHistory.push({
        user: membershipRequest.user,
        joinedAt: new Date(),
        reason: membershipRequest.reason
      });
    }
    
    await community.save();
    
    // Get user email for notification
    const user = await User.findById(membershipRequest.user).select("email firstName lastName");
    
    // Send email notification to the user
    await sendEmail({
      email: user.email,
      subject: `Community Membership Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your request to join the community "${community.displayTitle}" has been ${status}. ${
        status === "approved" 
          ? "You are now a member of this community and can start creating posts."
          : "If you wish to try again, you may submit a new request."
      }`
    });
    
    res.status(200).json({ 
      message: `Membership request ${status} successfully`,
      membershipRequest: community.membershipRequests[requestIndex]
    });
  } catch (error) {
    console.error("Handle membership request error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Handle exit request (approve/reject)
exports.handleExitRequest = async (req, res) => {
  try {
    const communityId = req.params.id;
    const requestId = req.params.requestId;
    const { status } = req.body; // status can be "approved" or "rejected"
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is the creator/expert
    if (community.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the community expert can approve or reject exit requests" });
    }
    
    // Find the exit request
    const requestIndex = community.exitRequests.findIndex(
      request => request._id.toString() === requestId
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({ message: "Exit request not found" });
    }
    
    const exitRequest = community.exitRequests[requestIndex];
    
    // If already processed
    if (exitRequest.status !== "pending") {
      return res.status(400).json({ message: `This request has already been ${exitRequest.status}` });
    }
    
    // Update request status
    exitRequest.status = status;
    exitRequest.responseDate = new Date();
    
    // If approved, remove user from members
    if (status === "approved") {
      // Find history entry for this user
      const historyEntry = community.memberHistory.find(
        entry => entry.user.toString() === exitRequest.user.toString() && !entry.leftAt
      );
      
      if (historyEntry) {
        historyEntry.leftAt = new Date();
        historyEntry.reason = exitRequest.reason;
      }
      
      // Remove from members list
      community.members = community.members.filter(
        memberId => memberId.toString() !== exitRequest.user.toString()
      );
    }
    
    await community.save();
    
    // Get user email for notification
    const user = await User.findById(exitRequest.user).select("email firstName lastName");
    
    // Send email notification to the user
    await sendEmail({
      email: user.email,
      subject: `Community Exit Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your request to leave the community "${community.displayTitle}" has been ${status}. ${
        status === "approved" 
          ? "You have been successfully removed from this community."
          : "You will remain a member of this community."
      }`
    });
    
    res.status(200).json({ 
      message: `Exit request ${status} successfully`,
      exitRequest: community.exitRequests[requestIndex]
    });
  } catch (error) {
    console.error("Handle exit request error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get pending membership requests for a community
exports.getPendingMembershipRequests = async (req, res) => {
  try {
    const communityId = req.params.id;
    console.log("Fetching membership requests for community:", communityId);
    console.log("User ID requesting:", req.user.id);
    
    const community = await Community.findById(communityId)
      .populate({
        path: 'membershipRequests.user',
        select: 'firstName lastName email profilePicture'
      });
    
    if (!community) {
      console.log("Community not found:", communityId);
      return res.status(404).json({ message: "Community not found" });
    }
    
    console.log("Community creator:", community.creator.toString());
    console.log("Requesting user:", req.user.id);
    
    // Check if user is the creator/expert
    if (community.creator.toString() !== req.user.id) {
      console.log("Permission denied: user is not the creator");
      return res.status(403).json({ message: "Only the community expert can view membership requests" });
    }
    
    // Filter only pending requests
    const pendingRequests = community.membershipRequests.filter(
      request => request.status === "pending"
    );
    
    console.log("Pending membership requests found:", pendingRequests.length);
    res.status(200).json(pendingRequests);
  } catch (error) {
    console.error("Get membership requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get pending exit requests for a community
exports.getPendingExitRequests = async (req, res) => {
  try {
    const communityId = req.params.id;
    
    const community = await Community.findById(communityId)
      .populate({
        path: 'exitRequests.user',
        select: 'firstName lastName email profilePicture'
      });
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is the creator/expert
    if (community.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the community expert can view exit requests" });
    }
    
    // Filter only pending requests
    const pendingRequests = community.exitRequests.filter(
      request => request.status === "pending"
    );
    
    res.status(200).json(pendingRequests);
  } catch (error) {
    console.error("Get exit requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get member history for a community
exports.getMemberHistory = async (req, res) => {
  try {
    const communityId = req.params.id;
    
    const community = await Community.findById(communityId)
      .populate({
        path: 'memberHistory.user',
        select: 'firstName lastName email'
      });
    
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }
    
    // Check if user is the creator/expert
    if (community.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the community expert can view member history" });
    }
    
    res.status(200).json(community.memberHistory);
  } catch (error) {
    console.error("Get member history error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
