const { v4: uuidv4 } = require("uuid");
const prisma = require("../config/prisma");
const cacheService = require("../config/cache");

const LOCK_DURATION_SECONDS = 600; // 10 minutes

class SeatLockService {
  async lockSeats({ scheduleId, transportMode, selectedSeats, classType = "3A", userId, couponCode }) {
    if (!scheduleId || !selectedSeats || selectedSeats.length === 0) {
      throw new Error("Schedule ID and at least one selected seat/berth are required");
    }

    // 1. Verify schedule exists
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
      throw new Error("The selected trip schedule was not found or has expired");
    }

    if (new Set(selectedSeats).size !== selectedSeats.length) throw new Error("Duplicate seat selections are not allowed");

    // Check confirmed bookings in the database for these seats
    const existingBookedPassengers = await prisma.bookingPassenger.findMany({
      where: {
        seatOrBerthNumber: { in: selectedSeats },
        status: "CONFIRMED",
        booking: {
          scheduleId,
          status: { in: ["CONFIRMED", "PENDING"] },
        },
      },
    });

    if (existingBookedPassengers.length > 0) {
      const bookedSeats = existingBookedPassengers.map((p) => p.seatOrBerthNumber).join(", ");
      throw new Error(`Seat(s) ${bookedSeats} have already been reserved. Please pick different seats.`);
    }

    // 3. Acquire atomic locks for all selected seats
    const lockToken = `lck_tok_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
    const expiresAt = new Date(Date.now() + LOCK_DURATION_SECONDS * 1000);

    const lockData = {
      lockToken,
      scheduleId,
      transportMode,
      selectedSeats,
      classType,
      userId: userId || null,
      lockedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const acquiredKeys = [];
    for (const seatNo of selectedSeats) {
      const lockKey = `lock:${scheduleId}:${seatNo}`;
      const acquired = await cacheService.setNX(lockKey, lockData, LOCK_DURATION_SECONDS);
      if (!acquired) {
        for (const key of acquiredKeys) await cacheService.delIfValue(key, lockToken);
        throw new Error(`Seat ${seatNo} is currently held by another traveler. Please choose another seat.`);
      }
      acquiredKeys.push(lockKey);
    }

    // Store token lookup
    try {
      await cacheService.set(`token:${lockToken}`, lockData, LOCK_DURATION_SECONDS);
    } catch (err) {
      for (const key of acquiredKeys) await cacheService.delIfValue(key, lockToken);
      throw err;
    }

    // 4. Calculate Fare Breakdown
    let baseRatePerSeat = 1080; // default
    if (transportMode === "train") {
      try {
        const pricing = JSON.parse(schedule.pricingTiersJson);
        baseRatePerSeat = pricing[classType] || 1080;
      } catch (e) {
        baseRatePerSeat = 1080;
      }
    } else if (transportMode === "bus") {
      try {
        const pricing = JSON.parse(schedule.pricingTiersJson);
        baseRatePerSeat = pricing.SLEEPER_LOWER_DOUBLE || pricing.SEATER || 1250;
      } catch (e) {
        baseRatePerSeat = 1250;
      }
    } else {
      try {
        const pricing = JSON.parse(schedule.pricingTiersJson);
        baseRatePerSeat = pricing[classType] || 1250;
      } catch (e) { baseRatePerSeat = 1250; }
    }

    const baseFare = baseRatePerSeat * selectedSeats.length;
    const taxes = Math.round(baseFare * 0.05); // 5% GST on AC transport
    const convenienceFee = 40.0; // Flat ₹40 platform fee
    let discount = 0.0;

    if (couponCode && couponCode.toUpperCase() === "SMART50") {
      discount = 50.0;
    } else if (couponCode && couponCode.toUpperCase() === "WELCOME100") {
      discount = 100.0;
    }

    const totalPayable = Math.max(0, baseFare + taxes + convenienceFee - discount);

    return {
      lockToken,
      scheduleId,
      transportMode,
      lockedSeats: selectedSeats,
      classType,
      countdownSeconds: LOCK_DURATION_SECONDS,
      expiresAt: expiresAt.toISOString(),
      fareBreakdown: {
        baseFare,
        ratePerSeat: baseRatePerSeat,
        seatCount: selectedSeats.length,
        taxes,
        convenienceFee,
        discount,
        couponApplied: discount > 0 ? couponCode.toUpperCase() : null,
        totalPayable,
      },
      scheduleDetails: {
        routeNumber: schedule.route.routeNumber,
        routeName: schedule.route.routeName,
        operator: schedule.route.operator,
        departureTime: schedule.departureTime.toISOString(),
        arrivalTime: schedule.arrivalTime.toISOString(),
        origin: schedule.route.originStation?.name || schedule.route.originBusStop?.name || "Origin",
        destination: schedule.route.destStation?.name || schedule.route.destBusStop?.name || "Destination",
      },
    };
  }

  async verifyLock(lockToken, userId) {
    if (!lockToken) return null;
    const lock = await cacheService.get(`token:${lockToken}`);
    if (lock && userId && lock.userId !== userId) return null;
    return lock;
  }

  async applyCoupon(lockToken, couponCode) {
    const lockData = await this.verifyLock(lockToken);
    if (!lockData) throw new Error("Seat hold expired. Please select seats again.");
    const discounts = { SMART50: 50, WELCOME100: 100 };
    const code = String(couponCode || "").trim().toUpperCase();
    if (!discounts[code]) throw new Error("Invalid coupon code. Try SMART50 or WELCOME100.");
    const discount = discounts[code];
    const fare = lockData.fareBreakdown;
    fare.discount = discount;
    fare.couponApplied = code;
    fare.totalPayable = Math.max(0, fare.baseFare + fare.taxes + fare.convenienceFee - discount);
    const ttl = Math.max(1, Math.ceil((new Date(lockData.expiresAt).getTime() - Date.now()) / 1000));
    await cacheService.set(`token:${lockToken}`, lockData, ttl);
    for (const seatNo of lockData.selectedSeats) {
      const key = `lock:${lockData.scheduleId}:${seatNo}`;
      const held = await cacheService.get(key);
      if (held?.lockToken !== lockToken) throw new Error("The seat hold expired. Please select seats again.");
      await cacheService.set(key, lockData, ttl);
    }
    return lockData;
  }

  async releaseSeats(lockToken, userId) {
    if (!lockToken) return false;
    const lockData = await cacheService.get(`token:${lockToken}`);
    if (!lockData) return false;
    if (userId && lockData.userId !== userId) return false;

    for (const seatNo of lockData.selectedSeats) {
      await cacheService.delIfValue(`lock:${lockData.scheduleId}:${seatNo}`, lockToken);
    }
    await cacheService.del(`token:${lockToken}`);
    return true;
  }
}

module.exports = new SeatLockService();
