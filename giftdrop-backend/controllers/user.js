exports.resetStats = async (req, res) => {
    try {
      await User.findByIdAndUpdate(req.userId, {
        balance: 1000,
        deposits: 0,
        openedCases: 0,
        bonuses: []
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };