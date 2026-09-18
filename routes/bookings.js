const express = require("express");
const router = express.Router();
const { sendTextMessage } = require("../services/whatsappService");
const { computeSplit } = require("../services/commissionService");

/**
 * Escrow model, matching your Phase-1 plan: a guest's deposit sits as
 * "held" until 24 hours after check-in, then a separate step releases
 * the host's payout. M-Pesa itself doesn't hold funds for you — this is
 * the internal ledger that actually enforces the hold; payments.js's
 * STK push just moves money into your own Paybill/Till in the meantime.
 */
let bookings = [];

// POST /api/bookings — create a reservation (deposit paid separately via /api/payments)
router.post("/", async (req, res) => {
  const { propertyId, guestPhone, checkIn, checkOut, category, price, listingSnapshot, addons } = req.body;
  if (!propertyId || !guestPhone || !category) {
    return res.status(400).json({ error: "propertyId, guestPhone, and category are required" });
  }
  const booking = {
    id: `B-${Date.now()}`,
    propertyId,
    guestPhone,
    checkIn: checkIn || null,
    checkOut: checkOut || null,
    category,
    price: price || null,
    addons: addons || [], // Partner Perks opt-ins — see partners.js
    depositStatus: "unpaid", // unpaid -> held -> released | refunded
    checkoutRequestId: null, // set once the STK push is initiated — see payments.js
    heldUntil: null, // set once the deposit is confirmed paid
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);

  await sendTextMessage(
    guestPhone,
    `Your reservation ${booking.id} on Solstice is held. Complete the M-Pesa deposit to confirm it.`
  );

  res.status(201).json(booking);
});

// GET /api/bookings/:id
router.get("/:id", (req, res) => {
  const booking = bookings.find((b) => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  res.json(booking);
});

// Internal helper — called from payments.js's M-Pesa callback once a
// deposit is confirmed paid. Not exposed as its own public route.
function markDepositHeld(checkoutRequestId) {
  const booking = bookings.find((b) => b.checkoutRequestId === checkoutRequestId);
  if (!booking) return null;
  const checkInDate = booking.checkIn ? new Date(booking.checkIn) : new Date();
  booking.depositStatus = "held";
  booking.heldUntil = new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
  return booking;
}

function attachCheckoutRequestId(bookingId, checkoutRequestId) {
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) return null;
  booking.checkoutRequestId = checkoutRequestId;
  return booking;
}

// POST /api/bookings/:id/release-payout — pays the host once the 24-hour
// post-check-in hold has passed. In production this would run on a cron
// rather than needing to be called manually.
router.post("/:id/release-payout", async (req, res) => {
  const booking = bookings.find((b) => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.depositStatus !== "held") {
    return res.status(400).json({ error: `Cannot release — deposit status is "${booking.depositStatus}"` });
  }
  if (new Date() < new Date(booking.heldUntil)) {
    return res.status(400).json({ error: `Still in escrow until ${booking.heldUntil}` });
  }

  const split = booking.price ? computeSplit(booking.price, booking.listingSnapshot || {}) : null;
  booking.depositStatus = "released";
  booking.payoutSplit = split;
  // INTEGRATION POINT: call mpesaService's b2cPayout(hostPhone, split.hostPayout, ...)
  // here once the host's own phone number is looked up via agents.js.
  res.json(booking);
});

module.exports = router;
module.exports.markDepositHeld = markDepositHeld;
module.exports.attachCheckoutRequestId = attachCheckoutRequestId;
