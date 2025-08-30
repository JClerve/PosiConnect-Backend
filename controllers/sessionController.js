const Session = require("../models/Session");

// Create session
exports.createSession = async (req, res) => {
  try {
    const expertId = req.body.expert || (req.user && req.user._id);
    if (!expertId)
      return res.status(400).json({ message: "Expert id required" });

    const session = new Session({
      expert: expertId,
      community: req.body.community,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      heading: req.body.heading,
      description: req.body.description,
      specialNote: req.body.specialNote,
      price: req.body.price != null ? req.body.price : 0,
    });

    await session.save();
    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// List sessions (optional filters: expertId, upcoming=true)
exports.getSessions = async (req, res) => {
  try {
    const { expertId, upcoming } = req.query;
    const filter = {};
    if (expertId) filter.expert = expertId;
    if (upcoming === "true") {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      filter.date = { $gte: `${yyyy}-${mm}-${dd}` };
    }
    const sessions = await Session.find(filter)
      .sort({ date: 1, startTime: 1 })
      .lean();
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get session by id
exports.getSessionById = async (req, res) => {
  try {
    const s = await Session.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ message: "Session not found" });
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update session by id (PUT)
exports.updateSession = async (req, res) => {
  try {
    const updates = {
      community: req.body.community,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      heading: req.body.heading,
      description: req.body.description,
      specialNote: req.body.specialNote,
      price: req.body.price != null ? req.body.price : 0,
      status: req.body.status,
    };

    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
