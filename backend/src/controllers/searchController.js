const searchService = require("../services/searchService");
const itineraryPlanner = require("../services/itineraryPlanner");
const locationService = require("../services/locationService");

exports.searchLocations = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ success: true, locations: [] });
    if (q.length > 80) return res.status(400).json({ success: false, message: "Search text is too long" });
    const locations = await locationService.search({ query: q, limit: req.query.limit });
    res.json({ success: true, locations });
  } catch (err) {
    next(err);
  }
};

exports.planItinerary = async (req, res, next) => {
  try {
    const { from, to, date } = req.query;
    if (!from || !to) return res.status(400).json({ success: false, message: "Source ('from') and destination ('to') are required" });
    const result = await itineraryPlanner.plan({ from, to, date });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { from, to, date, mode, sortBy, passengers } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Source ('from') and destination ('to') query parameters are required",
      });
    }
    if (String(from).trim().length > 80 || String(to).trim().length > 80) return res.status(400).json({ success: false, message: "Location search is limited to 80 characters" });
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, message: "Date must use YYYY-MM-DD format" });
    if (!await locationService.isKnownLocation(from) || !await locationService.isKnownLocation(to)) {
      return res.status(400).json({ success: false, message: "Select an origin and destination from the saved location suggestions" });
    }
    if (mode && !["all", "train", "bus", "flight", "cab"].includes(mode)) return res.status(400).json({ success: false, message: "Unsupported transport mode" });

    const data = await searchService.search({
      from,
      to,
      date,
      mode: mode || "all",
      sortBy: sortBy || "recommended",
      passengers: Math.min(9, Math.max(1, Number.parseInt(passengers, 10) || 1)),
      userId: req.user?.id,
    });

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
};
