const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const crypto = require("crypto");

const ticketSigningSecret = () => {
  const secret = process.env.TICKET_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret || (process.env.NODE_ENV === "production" && secret.length < 32)) {
    throw new Error("Set TICKET_SIGNING_SECRET (at least 32 characters in production) to sign tickets");
  }
  return secret;
};

function createTicketPayload(booking) {
  const ticketData = {
    pnr: booking.bookingPnr,
    mode: booking.transportMode,
    origin: booking.originName,
    destination: booking.destinationName,
    departure: booking.departureTime,
    arrival: booking.arrivalTime,
    seats: booking.passengers.map((p) => p.seatOrBerthNumber),
    status: booking.status,
  };
  const ticketHash = crypto.createHmac("sha256", ticketSigningSecret())
    .update(JSON.stringify(ticketData)).digest("hex");
  return { ...ticketData, ticketHash };
}

function verifyTicketPayload(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.ticketHash !== "string") return false;
  const { ticketHash, ...ticketData } = payload;
  if (!/^[a-f0-9]{64}$/i.test(ticketHash)) return false;
  try {
    const expected = crypto.createHmac("sha256", ticketSigningSecret()).update(JSON.stringify(ticketData)).digest();
    const received = Buffer.from(ticketHash, "hex");
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  } catch (_) { return false; }
}

class TicketService {
  async generateTicketPdf(booking) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 40 });
        const buffers = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(err));

        const isTrain = booking.transportMode === "train";
        const demoRecord = booking.schedule?.route?.dataStatus !== "VERIFIED";
        const modeLabel = { train: "TRAIN", bus: "INTERCITY BUS", flight: "FLIGHT", cab: "INTERCITY CAB" }[booking.transportMode] || "JOURNEY";
        const primaryColor = isTrain ? "#2563eb" : booking.transportMode === "bus" ? "#0d9488" : "#4f46e5";

        // 1. Generate QR Code Buffer
        const qrPayload = JSON.stringify(createTicketPayload(booking));
        const ticketHash = JSON.parse(qrPayload).ticketHash;

        const qrBuffer = await QRCode.toBuffer(qrPayload, {
          width: 110,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        });

        // 2. Draw Header Banner
        doc
          .rect(40, 40, 515, 60)
          .fill(primaryColor);

        doc
          .fillColor("#ffffff")
          .fontSize(22)
          .font("Helvetica-Bold")
          .text("SMART JOURNEY", 60, 52);

        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `${demoRecord ? "SAMPLE BOOKING RECORD · NOT OPERATOR-ISSUED" : "ELECTRONIC TRAVEL TICKET"} (${modeLabel})`,
            60,
            78
          );

        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(`Smart Journey ref: ${booking.bookingPnr}`, 355, 62, { align: "right", width: 185 });

        // 3. Journey Overview Card
        doc.rect(40, 115, 515, 95).lineWidth(1).strokeColor("#cbd5e1").stroke();

        doc
          .fillColor("#64748b")
          .fontSize(9)
          .font("Helvetica")
          .text("ROUTE & SERVICE DETAILS", 55, 125);

        doc
          .fillColor("#0f172a")
          .fontSize(13)
          .font("Helvetica-Bold")
          .text(`${booking.originName}  →  ${booking.destinationName}`, 55, 142);

        doc
          .fillColor("#334155")
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Departure: ${new Date(booking.departureTime).toLocaleString("en-IN")}`,
            55,
            165
          );

        doc
          .text(
            `Arrival: ${new Date(booking.arrivalTime).toLocaleString("en-IN")}`,
            55,
            182
          );

        let stops = [];
        try { stops = JSON.parse(booking.schedule?.route?.intermediateStopsJson || "[]"); } catch (_) {}
        const timelineY = 220;
        doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text("STATION TIMELINE", 40, timelineY);
        const timeline = [booking.originName, ...stops.map((s) => typeof s === "string" ? s : s.name || s.station || "Stop"), booking.destinationName];
        doc.font("Helvetica").fontSize(8).fillColor("#475569");
        timeline.slice(0, 7).forEach((stop, index) => {
          doc.text(`${index + 1}. ${stop}`, 45 + (index % 2) * 250, timelineY + 18 + Math.floor(index / 2) * 13, { width: 230 });
        });

        // Embed QR Code on the right
        doc.image(qrBuffer, 435, 120, { width: 85 });
        doc.fillColor("#64748b").fontSize(6).text(`Ticket verification hash: ${ticketHash}`, 370, 207, { width: 180, align: "right" });

        // 4. Passenger List Table
        doc
          .fillColor("#0f172a")
          .fontSize(11)
          .font("Helvetica-Bold")
          .text("PASSENGER DETAILS & BERTH ALLOCATIONS", 40, 280);

        // Table Header
        const tableTop = 298;
        doc
          .rect(40, tableTop, 515, 22)
          .fill("#f1f5f9");

        doc
          .fillColor("#475569")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("#", 50, tableTop + 6)
          .text("PASSENGER NAME", 80, tableTop + 6)
          .text("AGE / GENDER", 260, tableTop + 6)
          .text("CLASS", 360, tableTop + 6)
          .text("SEAT / BERTH", 440, tableTop + 6);

        // Table Rows
        let rowY = tableTop + 24;
        booking.passengers.forEach((pax, index) => {
          doc
            .rect(40, rowY, 515, 26)
            .fill(index % 2 === 0 ? "#ffffff" : "#f8fafc");

          doc
            .fillColor("#0f172a")
            .fontSize(9)
            .font("Helvetica")
            .text(`${index + 1}`, 50, rowY + 8)
            .text(pax.fullName, 80, rowY + 8)
            .text(`${pax.age} yrs / ${pax.gender}`, 260, rowY + 8)
            .text(pax.classType || "3A", 360, rowY + 8)
            .font("Helvetica-Bold")
            .fillColor(primaryColor)
            .text(pax.seatOrBerthNumber, 440, rowY + 8);

          rowY += 26;
        });

        // 5. Payment & Fare Summary Box
        const fareTop = rowY + 25;
        doc
          .rect(40, fareTop, 515, 80)
          .lineWidth(1)
          .strokeColor("#e2e8f0")
          .stroke();

        doc
          .fillColor("#0f172a")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("PAYMENT SUMMARY", 55, fareTop + 12);

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#475569")
          .text(`Base Fare: ₹${booking.baseFare.toFixed(2)}`, 55, fareTop + 30)
          .text(`Taxes (GST 5%): ₹${booking.taxes.toFixed(2)}`, 55, fareTop + 45)
          .text(`Convenience Fee: ₹${booking.convenienceFee.toFixed(2)}`, 55, fareTop + 60);

        doc
          .text(`Discount: -₹${booking.discountAmount.toFixed(2)}`, 250, fareTop + 30)
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor("#16a34a")
          .text(`TOTAL PAID: ₹${booking.totalAmount.toFixed(2)}`, 250, fareTop + 50);

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#64748b")
          .text(`Status: ${booking.status}`, 420, fareTop + 30)
          .text("Payment: Captured", 420, fareTop + 45);

        // 6. Important Travel Instructions
        const noteTop = fareTop + 100;
        doc
          .fillColor("#0f172a")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("IMPORTANT INSTRUCTIONS FOR TRAVELERS", 40, noteTop);

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#64748b")
          .text("1. Carry a valid government photo ID for every passenger.", 40, noteTop + 18)
          .text("2. Arrive at the platform or boarding terminal at least 30 minutes before departure.", 40, noteTop + 30)
          .text("3. QR code contains a signed ticket hash for integrity verification.", 40, noteTop + 42)
          .text("4. Cancellation eligibility and refund depend on the applicable policy.", 40, noteTop + 54);

        // Footer
        doc
          .fontSize(8)
          .fillColor("#94a3b8")
          .text("Smart Journey Technologies Pvt Ltd • 24x7 Support: support@smartjourney.com", 40, 780, {
            align: "center",
            width: 515,
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = Object.assign(new TicketService(), { createTicketPayload, verifyTicketPayload });
