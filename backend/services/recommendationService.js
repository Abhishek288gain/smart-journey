const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const numberValue = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

/*
|--------------------------------------------------------------------------
| Recommendation Engine
|--------------------------------------------------------------------------
|
| This is a content-based recommendation engine.
|
| It does NOT depend on Jabalpur/Mumbai.
|
| It scores every journey according to:
|
| 1. Route match
| 2. Price
| 3. Duration
| 4. Transport preference
| 5. User budget
| 6. Comfort
|
|--------------------------------------------------------------------------
*/

const calculateScore = (journey, preferences = {}) => {
  let score = 0;

  const price = numberValue(journey.price);

  const duration = numberValue(journey.duration);

  const journeyTransport = normalize(
    journey.transportType || journey.mode || journey.type,
  );

  const preferredTransport = normalize(
    preferences.transportType || preferences.transport,
  );

  const budget = numberValue(preferences.budget, Infinity);

  // --------------------------------------------------
  // Budget preference
  // --------------------------------------------------

  if (Number.isFinite(budget)) {
    if (price <= budget) {
      score += 30;
    } else {
      const difference = price - budget;

      score -= Math.min(30, (difference / Math.max(budget, 1)) * 30);
    }
  }

  // --------------------------------------------------
  // Transport preference
  // --------------------------------------------------

  if (preferredTransport && journeyTransport) {
    if (journeyTransport === preferredTransport) {
      score += 25;
    }
  }

  // --------------------------------------------------
  // Lower price = better
  // --------------------------------------------------

  if (price > 0) {
    const priceScore = Math.max(0, 20 - price / 500);

    score += Math.min(20, priceScore);
  }

  // --------------------------------------------------
  // Shorter journey = better
  // --------------------------------------------------

  if (duration > 0) {
    const durationScore = Math.max(0, 15 - duration / 4);

    score += Math.min(15, durationScore);
  }

  return Math.max(0, Math.round(score * 100) / 100);
};

const generateReason = (journey, preferences = {}) => {
  const reasons = [];

  const price = numberValue(journey.price);

  const budget = numberValue(preferences.budget, Infinity);

  const transport = journey.transportType || journey.mode || journey.type;

  if (Number.isFinite(budget) && price <= budget) {
    reasons.push("Within your budget");
  }

  if (
    preferences.transportType &&
    normalize(transport) === normalize(preferences.transportType)
  ) {
    reasons.push(`Matches your ${transport} preference`);
  }

  if (price > 0) {
    reasons.push("Good price option");
  }

  if (journey.duration && Number(journey.duration) < 12) {
    reasons.push("Relatively short travel time");
  }

  if (reasons.length === 0) {
    reasons.push("Matches your selected route");
  }

  return reasons;
};

const recommendJourneys = (journeys, preferences = {}) => {
  return journeys

    .map((journey) => {
      const score = calculateScore(journey, preferences);

      return {
        ...(journey.toObject ? journey.toObject() : journey),

        recommendationScore: score,

        recommendationReasons: generateReason(journey, preferences),
      };
    })

    .sort((a, b) => b.recommendationScore - a.recommendationScore);
};

module.exports = {
  recommendJourneys,
  calculateScore,
  generateReason,
};
