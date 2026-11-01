const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const seatLockService = require("../services/seatLockService");
const ticketService = require("../services/ticketService");
const cancellationService = require("../services/cancellationService");
const paymentService = require("../services/paymentService");

exports.lockSeats = async (req, res, next) => {
  try {
    const { scheduleId, transportMode, selectedSeats, classType, couponCode } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!scheduleId || !Array.isArray(selectedSeats) || selectedSeats.length === 0 || selectedSeats.length > 8 || selectedSeats.some((seat) => typeof seat !== "string" || seat.length > 20)) {
      return res.status(400).json({
        success: false,
        message: "Missing scheduleId or selectedSeats",
      });
    }

    const lockResult = await seatLockService.lockSeats({
      scheduleId,
      transportMode: transportMode || "train",
      selectedSeats,
      classType: classType || "3A",
      userId,
      couponCode,
    });

    res.json({
      success: true,
      message: "Seats reserved successfully for 10 minutes",
      ...lockResult,
    });
  } catch (err) {
    res.status(409).json({
      success: false,
      message: err.message,
    });
  }
};

exports.verifyLock = async (req, res, next) => {
  try {
    const { lockToken } = req.params;
    const lockData = await seatLockService.verifyLock(lockToken, req.user.id);

    if (!lockData) {
      return res.status(404).json({
        success: false,
        message: "Seat lock expired or invalid. Please select your seats again.",
      });
    }

    res.json({
      success: true,
      lockData,
    });
  } catch (err) {
    next(err);
  }
};

exports.applyCoupon = async (req, res, next) => {
  try {
    const lockData = await seatLockService.verifyLock(req.body.lockToken, req.user.id);
    if (!lockData) return res.status(404).json({ success: false, message: "Seat hold not found for this account" });
    const updatedLock = await seatLockService.applyCoupon(req.body.lockToken, req.body.couponCode);
    res.json({ success: true, fareBreakdown: updatedLock.fareBreakdown });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.releaseSeats = async (req, res, next) => {
  try {
    const { lockToken } = req.body;
    const released = await seatLockService.releaseSeats(lockToken, req.user.id);

    res.json({
      success: true,
      released,
      message: "Seats released back to general inventory",
    });
  } catch (err) {
    next(err);
  }
};

exports.createBooking = async (req, res, next) => {
  try {
    const {
      lockToken,
      scheduleId,
      transportMode,
      passengers,
      boardingPoint,
      droppingPoint,
      contactPhone,
      contactEmail,
      paymentMethod = "UPI",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      idempotencyKey,
    } = req.body;

    if (!lockToken || !scheduleId || !passengers || passengers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required booking fields (lockToken, scheduleId, passengers)",
      });
    }
    if (!Array.isArray(passengers) || passengers.length > 8 || passengers.some((passenger) =>
      !String(passenger.fullName || "").trim() || String(passenger.fullName).length > 120 ||
      !Number.isInteger(Number(passenger.age)) || Number(passenger.age) < 1 || Number(passenger.age) > 120 ||
      !["male", "female", "other"].includes(passenger.gender)
    )) return res.status(400).json({ success: false, message: "Each passenger needs a name, age from 1 to 120, and a selected gender" });

    // Check Idempotency (prevent duplicate charges / double bookings)
    if (idempotencyKey) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey },
        include: {
          booking: {
            include: { passengers: true },
          },
        },
      });
      if (existingPayment) {
        if (req.user && existingPayment.booking?.userId !== req.user.id) {
          return res.status(404).json({ success: false, message: "Booking not found" });
        }
        return res.json({
          success: true,
          booking: existingPayment.booking,
          idempotentReplay: true,
        });
      }
    }

    // Verify lock is still active before accepting a new paid booking.
    const lockData = await seatLockService.verifyLock(lockToken, req.user.id);
    if (!lockData) {
      return res.status(400).json({ success: false, message: "10-minute seat lock has expired. Please reselect your seats." });
    }
    if (lockData.scheduleId !== scheduleId || lockData.selectedSeats.length !== passengers.length) {
      return res.status(400).json({ success: false, message: "Booking details do not match the active seat hold" });
    }
    const paidOrder = await paymentService.getOrder(razorpayOrderId);
    if (!paidOrder || paidOrder.status !== "VERIFIED" || paidOrder.lockToken !== lockToken ||
        paidOrder.paymentId !== razorpayPaymentId ||
        paidOrder.amount !== Math.round(Number(lockData.fareBreakdown.totalPayable) * 100)) {
      return res.status(402).json({ success: false, message: "A verified payment for this seat hold is required" });
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        route: {
          include: {
            originStation: true,
            destStation: true,
            originBusStop: true,
            destBusStop: true,
          },
        },
      },
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    const userId = req.user.id;

    // Generate unique Indian travel PNR (e.g. "SJ89401258")
    const bookingPnr = `SJ${crypto.randomInt(10000000, 100000000)}`;

    const originName = schedule.route.originStation?.name || schedule.route.originBusStop?.name || "Origin";
    const destName = schedule.route.destStation?.name || schedule.route.destBusStop?.name || "Destination";

    // Fares
    const baseFare = lockData.fareBreakdown ? lockData.fareBreakdown.baseFare : 2160;
    const taxes = lockData.fareBreakdown ? lockData.fareBreakdown.taxes : 108;
    const convenienceFee = lockData.fareBreakdown ? lockData.fareBreakdown.convenienceFee : 40;
    const discountAmount = lockData.fareBreakdown ? lockData.fareBreakdown.discount : 0;
    const totalAmount = lockData.fareBreakdown ? lockData.fareBreakdown.totalPayable : 2308;

    // Database atomic transaction
    const booking = await prisma.$transaction(async (tx) => {
      const pendingBooking = await tx.booking.create({
        data: {
          bookingPnr,
          userId,
          scheduleId,
          transportMode: transportMode || schedule.route.mode,
          status: "PENDING",
          seatLockToken: lockToken,
          seatLockExpiresAt: new Date(lockData.expiresAt),
          departureTime: schedule.departureTime,
          arrivalTime: schedule.arrivalTime,
          originName,
          destinationName: destName,
          baseFare,
          taxes,
          convenienceFee,
          discountAmount,
          totalAmount,
          boardingPointJson: boardingPoint ? JSON.stringify(boardingPoint) : null,
          droppingPointJson: droppingPoint ? JSON.stringify(droppingPoint) : null,
          contactPhone,
          contactEmail,
          passengers: {
            create: passengers.map((p, idx) => ({
              fullName: p.fullName,
              age: Number(p.age),
              gender: p.gender,
              seatOrBerthNumber: p.seatOrBerthNumber || lockData.selectedSeats[idx] || `S${idx + 1}`,
              coachOrDeck: lockData.transportMode === "bus" ? "Lower Deck" : lockData.transportMode === "flight" ? "Flight cabin" : lockData.transportMode === "cab" ? "Vehicle" : "B3",
              classType: lockData.classType || "3A",
              status: "CONFIRMED",
              idProofType: p.idProofType || null,
              idProofNumber: p.idProofNumber || null,
            })),
          },
          payments: {
            create: {
              razorpayOrderId,
              razorpayPaymentId,
              paymentMethod: paidOrder.paymentMethod || paymentMethod,
              amount: totalAmount,
              status: "CAPTURED",
              idempotencyKey: idempotencyKey || `idem_${uuidv4().replace(/-/g, "").substring(0, 12)}`,
            },
          },
        },
        include: {
          passengers: true,
          payments: true,
          schedule: {
            include: {
              route: true,
            },
          },
        },
      });

      const confirmedBooking = await tx.booking.update({
        where: { id: pendingBooking.id },
        data: { status: "CONFIRMED" },
        include: {
          passengers: true,
          payments: true,
          schedule: { include: { route: true } },
        },
      });
      await tx.notification.create({ data: {
        userId,
        bookingId: confirmedBooking.id,
        type: "BOOKING_CONFIRMED",
        title: "Your booking is confirmed",
        message: `PNR ${confirmedBooking.bookingPnr} · ${originName} to ${destName}. Your e-ticket is ready.`,
      } });
      return confirmedBooking;
    });

    // Release temporary seat lock since seats are now permanently confirmed
    await seatLockService.releaseSeats(lockToken, req.user.id);

    res.status(201).json({
      success: true,
      message: "Booking confirmed successfully!",
      booking: {
        id: booking.id,
        pnr: booking.bookingPnr,
        bookingReference: booking.bookingPnr,
        referenceType: "SMART_JOURNEY_INTERNAL_REFERENCE",
        status: booking.status,
        transportMode: booking.transportMode,
        origin: booking.originName,
        destination: booking.destinationName,
        departureTime: booking.departureTime,
        arrivalTime: booking.arrivalTime,
        totalPaid: booking.totalAmount,
        passengers: booking.passengers,
        ticketDownloadUrl: `/api/trips/${booking.id}/ticket.pdf`,
        qrPayload: `${booking.bookingPnr}|${booking.passengers.map((p) => p.seatOrBerthNumber).join(",")}|CONFIRMED`,
      },
    });
  } catch (err) {
    console.error("Booking creation error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        passengers: true,
        payments: true,
        refunds: true,
        schedule: {
          include: {
            route: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (req.user && booking.userId !== req.user.id) return res.status(404).json({ success: false, message: "Booking not found" });

    res.json({
      success: true,
      booking,
    });
  } catch (err) {
    next(err);
  }
};

exports.listBookings = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Sign in to view bookings" });
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: { passengers: true, payments: true, refunds: true, schedule: { include: { route: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, bookings });
  } catch (err) { next(err); }
};

exports.downloadTicketPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        passengers: true,
        payments: true,
        schedule: { include: { route: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (req.user && booking.userId !== req.user.id) return res.status(404).json({ success: false, message: "Booking not found" });

    const pdfBuffer = await ticketService.generateTicketPdf(booking);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=SmartJourney_Ticket_${booking.bookingPnr}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

exports.verifyTicket = async (req, res, next) => {
  try {
    const payload = req.body?.ticket || req.body;
    if (!ticketService.verifyTicketPayload(payload)) {
      return res.status(400).json({ success: false, valid: false, message: "Ticket signature is invalid or ticket data was modified" });
    }
    const booking = await prisma.booking.findUnique({
      where: { bookingPnr: payload.pnr },
      include: { passengers: true },
    });
    if (!booking) return res.status(404).json({ success: true, valid: false, message: "Ticket booking was not found" });
    const currentPayload = ticketService.createTicketPayload(booking);
    const matchesCurrentBooking = JSON.stringify(currentPayload) === JSON.stringify(payload);
    const valid = matchesCurrentBooking && booking.status === "CONFIRMED";
    res.json({
      success: true,
      valid,
      status: booking.status,
      message: valid ? "Ticket is valid and booking is confirmed" : "Ticket is authentic but is no longer valid for travel",
      ticket: valid ? {
        bookingReference: booking.bookingPnr, mode: booking.transportMode, origin: booking.originName,
        destination: booking.destinationName, departure: booking.departureTime,
        seats: booking.passengers.map((passenger) => passenger.seatOrBerthNumber),
      } : undefined,
    });
  } catch (err) { next(err); }
};

exports.cancelPreview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { passengers: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (!req.user || booking.userId !== req.user.id) return res.status(404).json({ success: false, message: "Booking not found" });

    const preview = cancellationService.calculateRefundPreview(booking);
    res.json({
      success: true,
      ...preview,
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (!req.user || booking.userId !== req.user.id) return res.status(404).json({ success: false, message: "Booking not found" });
    const preview = cancellationService.calculateRefundPreview(booking);
    if (!preview.canCancel) return res.status(400).json({ success: false, message: preview.policyExplanation, ...preview });

    const result = await cancellationService.cancelBooking(id, reason);
    res.json({
      success: true,
      message: "Booking cancelled and refund processed",
      ...result,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
