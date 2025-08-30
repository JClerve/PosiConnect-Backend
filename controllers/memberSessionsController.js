const Session = require("../models/Session");
const Community = require("../models/Community");

// GET /api/sessions/member/upcoming
exports.getUpcomingForMember = async (req, res) => {
  try {
    const userId = req.user._id;

    // get communities user is a member of
    const communities = await Community.find({ members: userId }).select("_id");
    const communityIds = communities.map((c) => c._id);

    if (communityIds.length === 0) {
      return res.status(200).json([]);
    }

    // fetch sessions in those communities
    const sessions = await Session.find({
      community: { $in: communityIds },
      status: "scheduled",
    })
      .populate("expert", "firstName lastName profilePicture")
      .populate("community", "name displayTitle")
      .lean();

    // filter upcoming by date (assume date stored as YYYY-MM-DD)
    const today = new Date();
    const upcoming = sessions
      .filter((s) => {
        try {
          const parts = s.date.split("-");
          const d = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
          );
          return (
            d >=
            new Date(today.getFullYear(), today.getMonth(), today.getDate())
          );
        } catch (err) {
          return false;
        }
      })
      .sort((a, b) => {
        if (a.date === b.date) return a.startTime.localeCompare(b.startTime);
        return a.date.localeCompare(b.date);
      });

    return res.status(200).json(upcoming);
  } catch (error) {
    console.error("getUpcomingForMember error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/sessions/member/:id/join
exports.joinSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const sessionId = req.params.id;

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    // ensure user is a member of the session's community
    const community = await Community.findOne({
      _id: session.community,
      members: userId,
    });
    if (!community) {
      return res
        .status(403)
        .json({
          message: "You must be a member of the community to join this session",
        });
    }

    // add participant if not already added
    const alreadyJoined = (session.participants || []).some(
      (p) => p.toString() === userId.toString()
    );
    if (!alreadyJoined) {
      session.participants = session.participants || [];
      session.participants.push(userId);
      await session.save();
    }

    return res
      .status(200)
      .json({ message: "Joined session successfully", joined: true });
  } catch (error) {
    console.error("joinSession error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
