const Journey = require("../models/Journey");

const { recommendJourneys } = require("../services/recommendationService");

// =====================================================
// GET ALL JOURNEYS
// =====================================================

const getJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: journeys.length,
      journeys,
    });
  } catch (error) {
    console.error("Get journeys error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch journeys",
    });
  }
};

// =====================================================
// SEARCH + AI RECOMMENDATIONS
// =====================================================

const getRecommendations = async (req, res) => {
  try {
    const { from, to, date, budget, transportType, sort } = req.query;

    // -----------------------------------------------
    // Validate route
    // -----------------------------------------------

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "From and To locations are required",
      });
    }

    // -----------------------------------------------
    // Dynamic MongoDB query
    // -----------------------------------------------

    const query = {
      from: {
        $regex: from.trim(),
        $options: "i",
      },

      to: {
        $regex: to.trim(),
        $options: "i",
      },
    };

    // -----------------------------------------------
    // Optional date
    // -----------------------------------------------

    if (date) {
      const startDate = new Date(date);

      if (!Number.isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);

        endDate.setDate(endDate.getDate() + 1);

        query.date = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    // -----------------------------------------------
    // Fetch journeys
    // -----------------------------------------------

    const journeys = await Journey.find(query);

    // -----------------------------------------------
    // No route found
    // -----------------------------------------------

    if (!journeys.length) {
      return res.json({
        success: true,
        count: 0,
        recommendations: [],
        message: `No journeys found from ${from} to ${to}`,
      });
    }

    // -----------------------------------------------
    // AI recommendation preferences
    // -----------------------------------------------

    const preferences = {
      budget: budget ? Number(budget) : undefined,

      transportType,
    };

    // -----------------------------------------------
    // Rank journeys
    // -----------------------------------------------

    let recommendations = recommendJourneys(journeys, preferences);

    // -----------------------------------------------
    // Optional sorting
    // -----------------------------------------------

    if (sort === "price") {
      recommendations.sort(
        (a, b) => Number(a.price || 0) - Number(b.price || 0),
      );
    }

    if (sort === "duration") {
      recommendations.sort(
        (a, b) => Number(a.duration || 0) - Number(b.duration || 0),
      );
    }

    res.json({
      success: true,

      query: {
        from,
        to,
        date: date || null,
        budget: budget || null,
        transportType: transportType || null,
      },

      count: recommendations.length,

      recommendations,
    });
  } catch (error) {
    console.error("Recommendation error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to generate recommendations",

      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getJourneys,
  getRecommendations,
};
