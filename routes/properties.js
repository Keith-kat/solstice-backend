const express = require("express");
const router = express.Router();
const { stkPush } = require("../services/mpesaService");
const { rateForListing } = require("../services/commissionService");

/**
 * In-memory mock store, matching the Safina backend's pattern: swap for
 * Postgres/Supabase once ready, without changing the route contracts.
 */
let listings = [
  {
    id: "L-1042",
    title: "Two-bedroom garden apartment",
    area: "Kilimani, Nairobi",
    category: "nightly", // nightly | weekly | monthly | lease | buy | land
    price: 6500,
    agentId: "A-01",
    status: "verified", // pending | verified | changes_requested | rejected
    photographed: true, // Photography & Verification add-on — unlocks the 12% commission tier
    verificationVisit: null, // { scheduledFor, fee, feeWaived } once requested
    featuredUntil: null, // Featured Listings boost — ISO timestamp, null/past = not boosted
    createdAt: new Date().toISOString(),
  },
];

const BOOST_FEES_KES = { "3d": 500, "7d": 1200, "14d": 2000 };
const PHOTOGRAPHY_FEE_KES = Number(process.env.PHOTOGRAPHY_FEE_KES || 3500);
const FREE_PHOTOGRAPHY_COHORT_SIZE = Number(process.env.FREE_PHOTOGRAPHY_COHORT_SIZE || 50);

// GET /api/properties?category=nightly&area=Kilimani&sort=featured
router.get("/", (req, res) => {
  const { category, area, status, sort } = req.query;
  let result = listings;
  if (category) result = result.filter((l) => l.category === category);
  if (area) result = result.filter((l) => l.area.toLowerCase().includes(area.toLowerCase()));
  // The public endpoint only ever returns verified listings by default —
  // this is the trust guarantee, enforced server-side, not just in the UI.
  result = result.filter((l) => (status ? l.status === status : l.status === "verified"));

  if (!sort || sort === "featured") {
    const now = Date.now();
    const isBoosted = (l) => l.featuredUntil && new Date(l.featuredUntil).getTime() > now;
    result = [...result].sort((a, b) => (isBoosted(b) ? 1 : 0) - (isBoosted(a) ? 1 : 0));
  }

  res.json(result.map((l) => ({ ...l, commissionRate: rateForListing(l) })));
});

// GET /api/properties/:id
router.get("/:id", (req, res) => {
  const listing = listings.find((l) => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  res.json({ ...listing, commissionRate: rateForListing(listing) });
});

// POST /api/properties  — agent submits a new listing; starts as "pending"
router.post("/", (req, res) => {
  const { title, area, category, price, agentId, wantsPhotography } = req.body;
  if (!title || !area || !category || !price || !agentId) {
    return res.status(400).json({ error: "title, area, category, price, and agentId are required" });
  }
  const listing = {
    id: `L-${Math.floor(1000 + Math.random() * 9000)}`,
    title,
    area,
    category,
    price,
    agentId,
    status: "pending",
    photographed: false,
    verificationVisit: wantsPhotography
      ? { scheduledFor: null, fee: null, feeWaived: null } // finalized once staff schedules it
      : null,
    featuredUntil: null,
    createdAt: new Date().toISOString(),
  };
  listings.push(listing);
  res.status(201).json(listing);
});

// PATCH /api/properties/:id/status — staff-only verification decision
// Wire this behind an admin-role auth middleware before going live.
router.patch("/:id/status", (req, res) => {
  const { status, reason } = req.body;
  const listing = listings.find((l) => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (!["pending", "verified", "changes_requested", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  listing.status = status;
  listing.statusReason = reason || null;
  res.json(listing);
});

// POST /api/properties/:id/verification-visit — staff schedules the local
// photographer/verifier. Fee is waived for the first N hosts onboarded
// (your manual "20–50 hosts for free" Phase 1 cohort), otherwise charged
// the standard Photography & Verification fee.
router.post("/:id/verification-visit", (req, res) => {
  const { scheduledFor } = req.body;
  const listing = listings.find((l) => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const cohortIndex = listings.filter((l) => l.verificationVisit).length;
  const feeWaived = cohortIndex < FREE_PHOTOGRAPHY_COHORT_SIZE;

  listing.verificationVisit = {
    scheduledFor: scheduledFor || null,
    fee: feeWaived ? 0 : PHOTOGRAPHY_FEE_KES,
    feeWaived,
  };
  res.json(listing);
});

// PATCH /api/properties/:id/photographed — staff marks the visit done.
// This is what actually unlocks the 12% commission rate.
router.patch("/:id/photographed", (req, res) => {
  const listing = listings.find((l) => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  listing.photographed = true;
  res.json({ ...listing, commissionRate: rateForListing(listing) });
});

// POST /api/properties/:id/feature — Featured Listings monetization.
// Kicks off an STK push for the boost fee; on a real build, only flip
// featuredUntil once the M-Pesa callback confirms payment (see
// payments.js) rather than immediately, as this mock does for the demo.
router.post("/:id/feature", async (req, res) => {
  const { phone, tier } = req.body; // tier: "3d" | "7d" | "14d"
  const listing = listings.find((l) => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.status !== "verified") {
    return res.status(400).json({ error: "Only verified listings can be featured" });
  }
  const amount = BOOST_FEES_KES[tier] || BOOST_FEES_KES["7d"];
  const days = Number.parseInt(tier, 10) || 7;

  try {
    const result = await stkPush({
      phone,
      amount,
      accountRef: listing.id,
      description: `Solstice Featured Listing — ${listing.id}`,
    });
    // Demo-only: real code waits for the callback before boosting.
    listing.featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    res.json({ listing, mpesa: result });
  } catch (err) {
    res.status(502).json({ error: "M-Pesa request failed", detail: err.message });
  }
});

module.exports = router;
