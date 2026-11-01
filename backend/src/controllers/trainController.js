const trainDataProvider = require("../providers/TrainDataProvider");

exports.searchTrains = async (req, res, next) => {
  try {
    const { from, to, date } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: "Origin and destination required" });
    }
    const results = await trainDataProvider.searchTrains({ origin: from, destination: to, travelDate: date });
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    next(err);
  }
};

exports.getLiveStatus = async (req, res, next) => {
  try {
    const { trainNo } = req.params;
    if (!trainNo) {
      return res.status(400).json({ success: false, message: "Train number required" });
    }
    const data = await trainDataProvider.getLiveRunningStatus(trainNo);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.checkPnr = async (req, res, next) => {
  try {
    const { pnr } = req.params;
    if (!pnr) {
      return res.status(400).json({ success: false, message: "PNR number required" });
    }
    const data = await trainDataProvider.checkPnrStatus(pnr);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
