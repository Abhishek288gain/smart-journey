const prisma = require("../config/prisma");
const paymentService = require("./paymentService");

class CancellationService {
  calculateRefundPreview(booking) {
    const now = new Date();
    const depTime = new Date(booking.departureTime);
    const diffHours = (depTime - now) / (1000 * 60 * 60);

    const totalAmount = booking.totalAmount;
    let cancellationFee = 0;
    let refundAmount = 0;
    let policyExplanation = "";

    const isTrain = booking.transportMode === "train";

    if (isTrain) {
      if (diffHours >= 48) {
        cancellationFee = 120 * booking.passengers.length;
        refundAmount = Math.max(0, totalAmount - cancellationFee);
        policyExplanation = "More than 48 hours before departure: Standard IRCTC flat clerkage fee of ₹120/passenger.";
      } else if (diffHours >= 12 && diffHours < 48) {
        cancellationFee = Math.round(totalAmount * 0.25);
        refundAmount = totalAmount - cancellationFee;
        policyExplanation = "Between 12 to 48 hours before departure: 25% cancellation charge applied.";
      } else if (diffHours >= 4 && diffHours < 12) {
        cancellationFee = Math.round(totalAmount * 0.50);
        refundAmount = totalAmount - cancellationFee;
        policyExplanation = "Between 4 to 12 hours before departure: 50% cancellation charge applied.";
      } else {
        cancellationFee = totalAmount;
        refundAmount = 0;
        policyExplanation = "Less than 4 hours before departure: No refund permissible after reservation charting.";
      }
    } else {
      // Bus operator cancellation policy
      if (diffHours >= 24) {
        cancellationFee = Math.round(totalAmount * 0.10);
        refundAmount = totalAmount - cancellationFee;
        policyExplanation = "More than 24 hours before departure: 10% operator cancellation fee.";
      } else if (diffHours >= 12 && diffHours < 24) {
        cancellationFee = Math.round(totalAmount * 0.25);
        refundAmount = totalAmount - cancellationFee;
        policyExplanation = "Between 12 to 24 hours before departure: 25% operator cancellation fee.";
      } else if (diffHours >= 4 && diffHours < 12) {
        cancellationFee = Math.round(totalAmount * 0.50);
        refundAmount = totalAmount - cancellationFee;
        policyExplanation = "Between 4 to 12 hours before departure: 50% operator cancellation fee.";
      } else {
        cancellationFee = totalAmount;
        refundAmount = 0;
        policyExplanation = "Under 4 hours before departure: Non-refundable.";
      }
    }

    return {
      bookingId: booking.id,
      pnr: booking.bookingPnr,
      totalAmount,
      cancellationFee,
      refundableAmount: refundAmount,
      policyExplanation,
      canCancel: refundAmount > 0 || diffHours > 4,
    };
  }

  async cancelBooking(bookingId, reason = "Customer request") {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        passengers: true,
        payments: true,
      },
    });

    if (!booking) {
      throw new Error("Booking record not found");
    }

    if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
      throw new Error("This booking has already been cancelled");
    }

    const preview = this.calculateRefundPreview(booking);
    const payment = booking.payments[0] || null;
    const refundDetails = await paymentService.createRefund(payment?.razorpayPaymentId, preview.refundableAmount);

    // Atomic transaction: Update booking status, mark passengers cancelled, create refund record
    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
        },
      });

      await tx.bookingPassenger.updateMany({
        where: { bookingId },
        data: { status: "CANCELLED" },
      });

      const refund = await tx.refund.create({
        data: {
          bookingId,
          paymentId: payment ? payment.id : null,
          razorpayRefundId: refundDetails.refundId,
          originalAmount: preview.totalAmount,
          cancellationFee: preview.cancellationFee,
          refundAmount: preview.refundableAmount,
          refundStatus: refundDetails.status,
          reason,
        },
      });

      await tx.notification.create({ data: {
        userId: booking.userId,
        bookingId,
        type: "REFUND_ISSUED",
        title: "Booking cancelled",
        message: preview.refundableAmount > 0
          ? `Your booking ${booking.bookingPnr} was cancelled. Refund: ₹${preview.refundableAmount}.`
          : `Your booking ${booking.bookingPnr} was cancelled. This booking is not eligible for a refund.`,
      } });

      return {
        booking: updatedBooking,
        refund,
      };
    });

    return {
      success: true,
      bookingStatus: "CANCELLED",
      refund: result.refund,
      preview,
    };
  }
}

module.exports = new CancellationService();
