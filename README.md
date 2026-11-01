# Smart Journey Planner

Smart Journey is a React/Vite frontend with an Express API and Prisma/SQLite database. It includes saved-location autocomplete, train/bus/flight/cab search, a time-aware multimodal route planner, OTP sign-in, demo seat holds and checkout, booking history, ticket records, and account alerts.

## Local setup

Requirements: Node.js 18+ and npm. Redis is optional for a single local development process.

1. In `backend`, install dependencies and copy `.env.example` to `.env`.
2. Keep `DATABASE_URL="file:./dev.db"` and `OTP_MODE=mock` for local development. Use separate random values for `JWT_SECRET` and `TICKET_SIGNING_SECRET`.
3. From `backend`, run `npm run db:push`, then `npm run prisma:generate` if the client did not generate during the schema update.
4. Run `npm run import:demo-catalog` to add the sample transport catalog and city nodes, then `npm run import:attached-data` to load the supplied JSON files. Both importers are repeatable and do not clear users, bookings, or existing routes.
5. Run `npm run dev` in `backend`.
6. In `frontend`, copy `.env.example` to `.env`, set `VITE_API_URL=http://localhost:5000/api`, run `npm install`, then `npm run dev`.

Open the URL printed by Vite (normally `http://localhost:5173`). Do not run the legacy destructive Prisma seed on an existing database; it deletes current records before seeding its small base dataset.

## Transport catalog and data integrity

The project includes a generated sample catalog of 500 train and 200 bus services. The additional files in `backend/data/transport-demo/` add **500 train, 500 bus, and 200 flight records** to the `transport_dataset_records` table. They are synthetic examples, not real operator services. The importer stores each original JSON record and refuses rows that are not explicitly marked `DEMO`, `isDemo: true`, and `verified: false`. **Verified live services: 0.** No authorized rail, bus, or flight booking/availability feed is configured.

Generated services use `DEMO-` identifiers and carry `DEMO` data status. Supplied JSON results are also marked as demo, with booking disabled because their records say booking is unsupported. Sample times and fare estimates are not verified operator inventory. The sample seat selector and payment flow are for college demonstration only. A Smart Journey booking reference is internal; it is not an IRCTC PNR or an operator-issued reservation. The e-ticket PDF is labeled as a demo travel record.

Train results include an IRCTC search handoff and bus results include a date-prefilled redBus route search. Travelers complete these real purchases on the external provider site. The in-app seat hold and checkout for non-verified catalog services are labeled as demo flows and do not reserve real operator inventory.

`GET /api/locations/search?q=A&limit=20` searches saved cities, stations and bus terminals, plus the supplied demo airport/station/terminal records. `GET /api/search/plans?from=Gwalior&to=Rishikesh&date=YYYY-MM-DD` calculates up-to-three-leg connections from stored schedules and the imported recurring demo records. It considers transfer gaps and fastest/cheapest/fewest-transfer/balanced weights. All imported records remain visibly marked DEMO in search and plan results.

### Flight search

Google Flights search results are fetched through SerpApi. `backend/.env` contains the local `SERPAPI_API_KEY`; keep it private and never copy it to frontend config or source control. Searches use the selected origin, destination, date, and passenger count, and return available itineraries with INR prices, stops, airline, and departure/arrival times. Common Indian cities map to IATA airport codes. Flight cards link to Google Flights so the traveler can choose an airline or booking seller and complete purchase there. SerpApi supplies search results and booking links; Smart Journey does not collect payment or issue an airline ticket for those external flights. The imported JSON flight records remain synthetic and marked `DEMO`. Restart the backend after changing the SerpApi key. The older optional Aviationstack integration is only a status-data fallback.

To show real availability, fares, schedules, or provider PNRs, add a licensed transport API/account, document its terms, implement its adapter and reservation-confirmation flow, and import provider-sourced records with `dataStatus=VERIFIED`. Do not relabel sample rows as verified.

## Authentication and OTP

- Local mode defaults to development mock OTP only when `OTP_MODE` is unset and no Twilio credentials are configured. The API response explicitly identifies the mock mode and returns the test code; the UI labels it as development-only.
- Real Indian phone OTP requires Twilio SMS configuration and `OTP_MODE=sms`. The API normalizes Indian numbers, expires codes after five minutes, enforces resend cooldowns and attempt/request limits, and stores an HMAC digest rather than the OTP itself.
- Production refuses `OTP_MODE=mock`, requires Twilio for phone verification, and requires Redis for shared rate limits and seat locks.
- Booking, checkout, profile, trips, notifications, cancellation, and payment APIs require a bearer token. Search and location autocomplete remain public.

## Payments and booking

Local checkout runs in `PAYMENT_MODE=mock`; it creates a server-side order, verifies the mock flow server-side, and records an internal demo booking. Live Razorpay order and payment verification use `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; webhooks also require `RAZORPAY_WEBHOOK_SECRET`. The API checks the captured payment with Razorpay before creating a booking. Live checkout is rejected for sample catalog records. A real operator reservation integration is still required before the site can sell or confirm real travel.

Never store card details or UPI PINs. Do not put SMS or payment secrets in frontend environment variables; only the non-secret API URL belongs in `VITE_API_URL`.

## Environment variables

Backend variables are documented in `backend/.env.example`:

- `NODE_ENV`, `PORT`, `CLIENT_ORIGIN`, `DATABASE_URL`
- `JWT_SECRET`, `TICKET_SIGNING_SECRET`
- `OTP_MODE=mock|sms`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `PAYMENT_MODE=mock|live`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `REDIS_URL` (required in production)
- `SERPAPI_API_KEY`, `SERPAPI_BASE_URL` for Google Flights search (keep the key in backend `.env` only)
- Optional email delivery: `RESEND_API_KEY`, `OTP_FROM_EMAIL`

Frontend: `VITE_API_URL` in `frontend/.env.example`.

## API highlights

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/locations/search` | Persisted and demo city/station/airport/terminal suggestions |
| `GET` | `/api/search` | Direct multi-mode service search |
| `GET` | `/api/search/plans` | Time-dependent connected itinerary options |
| `POST` | `/api/auth/send-otp`, `/api/auth/verify-otp` | Rate-limited OTP flow |
| `POST` | `/api/bookings/lock-seats`, `/api/bookings/create` | Authenticated demo hold and paid booking record |
| `POST` | `/api/payments/create-order`, `/api/payments/verify` | Server-created order and verification |
| `POST` | `/api/payments/webhook` | Razorpay signature-verified event handler |
| `GET` | `/api/bookings` | Authenticated booking history |
| `GET` | `/api/trips/:id/ticket.pdf` | Authenticated demo ticket PDF |

## Checks

From `backend`, run `npm test` for the route-connection tests and `npm run db:push` to validate/apply the Prisma schema. From `frontend`, run `npm run build`.

## Production notes and remaining work

Set `NODE_ENV=production`, configure real Twilio and Razorpay credentials, a strong 32+ character JWT and ticket signing secret, Redis, HTTPS, and the exact frontend origin. The server refuses mock payment and OTP modes in production. Configure the Razorpay webhook URL as `https://<api-host>/api/payments/webhook`.

The repository does not contain licensed live train/bus inventory, external railway PNR lookup, provider reservation/confirmation APIs, or real transport booking credentials. Those integrations and an authorized data source are required before live fares, seat availability, provider-issued PNRs, refunds, or real transport reservations can be offered. The current demo catalog contains no verified service records.
