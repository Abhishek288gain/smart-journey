# Smart Journey Planner - Demo Transport Dataset

Files:
- trains.json: 500 synthetic train-shaped records
- buses.json: 500 synthetic bus-shaped records
- flights.json: 200 synthetic flight-shaped records

IMPORTANT:
Every record is explicitly marked:
  recordType = "DEMO"
  isDemo = true
  verified = false

These are synthetic records for UI, search, route-engine, and database integration testing.
They are NOT real train/bus/flight services. Names, service numbers, timings, fares,
availability, routes, and operators must not be represented as verified live data.
No real PNRs are included. PNR is null for every train.

MongoDB import examples:
  mongoimport --uri "$MONGODB_URI" --db smart_journey_planner --collection trains --file trains.json --jsonArray
  mongoimport --uri "$MONGODB_URI" --db smart_journey_planner --collection buses --file buses.json --jsonArray
  mongoimport --uri "$MONGODB_URI" --db smart_journey_planner --collection flights --file flights.json --jsonArray

Suggested indexes:
  db.trains.createIndex({ "source.stationCode": 1, "destination.stationCode": 1 })
  db.trains.createIndex({ trainNumber: 1 }, { unique: true })
  db.buses.createIndex({ "source.city": 1, "destination.city": 1 })
  db.buses.createIndex({ serviceId: 1 }, { unique: true })
  db.flights.createIndex({ "source.airportCode": 1, "destination.airportCode": 1 })
  db.flights.createIndex({ flightNumber: 1 })

Before production:
Replace DEMO records with data obtained from legitimate licensed/authorized providers.
Do not mix demo and verified records in search results without a visible data-source label.
