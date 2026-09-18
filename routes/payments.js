const express = require("express");
const router = express.Router();
const { stkPush, b2cPayout } = require("../services/mpesaService");
const { sendBookingConfirmation } = require("../services/whatsappService");
const bookingsRoutes = require("./bookings");

// POST /api/payments/mpesa/stk — called from the "Reserve with M-Pesa" button
router.post("/mpesa/stk", async (req, res) => {
  const { phone, amount, bookingId } = req.body;
  if (!phone || !amount || !bookingId) {
    return res.status(400).json({ error: "phone, amount, and bookingId are required" });
  }
  try {
    const result = await stkPush({
      phone,
      amount,
      accountRef: bookingId,
      description: `Solstice reservation ${bookingId}`,
    });
    // Track which STK push belongs to which booking so the callback below
    // can find its way back to the right record.
    bookingsRoutes.attachCheckoutRequestId(bookingId, result.CheckoutRequestID);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "M-Pesa request failed", detail: err.message });
  }
});

// POST /api/payments/mpesa/callback — Safaricom calls this once the
// customer enters their PIN. Marks the matching booking's deposit as
// held (starting the 24-hour escrow clock) and fires the WhatsApp
// confirmation — the "Direct WhatsApp Pipeline" differentiation, so the
// guest never has to open the app or check email for this.
router.post("/mpesa/callback", async (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (callback) {
    const success = callback.ResultCode === 0;
    if (success) {
      const booking = bookingsRoutes.markDepositHeld(callback.CheckoutRequestID);
      if (booking) {
        await sendBookingConfirmation(booking.guestPhone, booking);
      }
    } else {
      console.log(`M-Pesa payment failed — ${callback.CheckoutRequestID}: ${callback.ResultDesc}`);
    }
  }
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// POST /api/payments/mpesa/payout — host (or partner) payout via Daraja
// B2C, called from bookings.js's release-payout step once the escrow
// hold has passed.
router.post("/mpesa/payout", async (req, res) => {
  const { phone, amount, remarks } = req.body;
  if (!phone || !amount) {
    return res.status(400).json({ error: "phone and amount are required" });
  }
  try {
    const result = await b2cPayout(phone, amount, remarks || "Solstice payout");
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "M-Pesa payout failed", detail: err.message });
  }
});

module.exports = router;
