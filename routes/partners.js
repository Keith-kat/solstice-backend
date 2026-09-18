const express = require("express");
const router = express.Router();

/**
 * Partner Perks (Phase 2): local airport-transfer drivers and cleaning
 * services, referred a booking's guest/host and taking a percentage cut.
 * This is intentionally the simplest possible version — a real build
 * needs its own payout schedule, but the shape (register partner, log a
 * referral, take a cut) won't change much once volume justifies it.
 */
let partners = [];
let referrals = [];

// POST /api/partners — onboard an airport transfer driver or cleaning service
router.post("/", (req, res) => {
  const { name, type, area, phone, commissionPercent } = req.body;
  if (!name || !type || !phone) {
    return res.status(400).json({ error: "name, type, and phone are required" });
  }
  const partner = {
    id: `P-${partners.length + 1}`,
    name,
    type, // "airport_transfer" | "cleaning"
    area: area || null,
    phone,
    commissionPercent: commissionPercent || 15,
    active: true,
  };
  partners.push(partner);
  res.status(201).json(partner);
});

// GET /api/partners?type=airport_transfer&area=Diani
router.get("/", (req, res) => {
  const { type, area } = req.query;
  let result = partners.filter((p) => p.active);
  if (type) result = result.filter((p) => p.type === type);
  if (area) result = result.filter((p) => (p.area || "").toLowerCase().includes(area.toLowerCase()));
  res.json(result);
});

// POST /api/partners/:id/referral — log a booking-linked referral and the
// commission Solstice takes from the partner's fee for it.
router.post("/:id/referral", (req, res) => {
  const { bookingId, partnerFee } = req.body;
  const partner = partners.find((p) => p.id === req.params.id);
  if (!partner) return res.status(404).json({ error: "Partner not found" });
  if (!bookingId || !partnerFee) {
    return res.status(400).json({ error: "bookingId and partnerFee are required" });
  }
  const commission = Math.round(partnerFee * (partner.commissionPercent / 100));
  const referral = {
    id: `REF-${referrals.length + 1}`,
    partnerId: partner.id,
    bookingId,
    partnerFee,
    solsticeCommission: commission,
    partnerPayout: partnerFee - commission,
    createdAt: new Date().toISOString(),
  };
  referrals.push(referral);
  res.status(201).json(referral);
});

module.exports = router;
