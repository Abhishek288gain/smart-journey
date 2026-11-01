const busDataProvider = require("../providers/BusDataProvider");

exports.searchBuses = async (req, res, next) => {
  try {
    const { from, to, date } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: "Origin and destination required" });
    }
    const results = await busDataProvider.searchBuses({ origin: from, destination: to, travelDate: date });
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    next(err);
  }
};

exports.getSeatMap = async (req, res, next) => {
  try {
    const { busId } = req.params;
    if (!busId) {
      return res.status(400).json({ success: false, message: "Bus ID or Schedule ID required" });
    }
    const data = await busDataProvider.getSeatMap(busId);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.getLiveTracking = async (req, res, next) => {
  try {
    const { busId } = req.params;
    
    // Check if client requested Server-Sent Events (SSE)
    if (req.headers.accept && req.headers.accept.includes("text/event-stream")) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendLocation = async () => {
        try {
          const data = await busDataProvider.getLiveBusTracking(busId);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (e) {}
      };

      await sendLocation();
      const interval = setInterval(sendLocation, 4000); // 4-second GPS update

      req.on("close", () => {
        clearInterval(interval);
      });
      return;
    }

    // Default JSON response
    const data = await busDataProvider.getLiveBusTracking(busId);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};
