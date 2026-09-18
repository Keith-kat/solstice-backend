const express = require("express");
const router = express.Router();

/**
 * Double-blind reviews, per your Phase-2 plan: neither side's review is
 * visible until BOTH have submitted one, or 14 days pass since the
 * first submission — whichever comes first. This is what keeps a guest
 * or host from writing a softened review out of fear the other side
 * will retaliate once they see it.
 */
const REVEAL_WINDOW_DAYS = Number(process.env.REVIEW_REVEAL_WINDOW_DAYS || 14);

let reviewPairs = {}; // keyed by bookingId

function getOrCreate(bookingId) {
  if (!reviewPairs[bookingId]) {
    reviewPairs[bookingId] = { bookingId, guest: null, host: null, firstSubmittedAt: null };
  }
  return reviewPairs[bookingId];
}

function isRevealed(pair) {
  if (pair.guest && pair.host) return true;
  if (!pair.firstSubmittedAt) return false;
  const deadline = new Date(pair.firstSubmittedAt).getTime() + REVEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() >= deadline;
}

// POST /api/reviews — { bookingId, authorRole: "guest" | "host", rating, comment }
router.post("/", (req, res) => {
  const { bookingId, authorRole, rating, comment } = req.body;
  if (!bookingId || !["guest", "host"].includes(authorRole) || !rating) {
    return res.status(400).json({ error: "bookingId, authorRole (guest|host), and rating are required" });
  }
  const pair = getOrCreate(bookingId);
  if (pair[authorRole]) {
    return res.status(409).json({ error: `${authorRole} review already submitted for this booking` });
  }
  pair[authorRole] = { rating, comment: comment || "", submittedAt: new Date().toISOString() };
  if (!pair.firstSubmittedAt) pair.firstSubmittedAt = pair[authorRole].submittedAt;

  res.status(201).json({ received: true, revealed: isRevealed(pair) });
});

// GET /api/reviews/:bookingId — returns both reviews only once revealed;
// otherwise just submission status, never the hidden content.
router.get("/:bookingId", (req, res) => {
  const pair = reviewPairs[req.params.bookingId];
  if (!pair) return res.status(404).json({ error: "No reviews for this booking yet" });

  const revealed = isRevealed(pair);
  res.json({
    bookingId: pair.bookingId,
    revealed,
    guestSubmitted: Boolean(pair.guest),
    hostSubmitted: Boolean(pair.host),
    guest: revealed ? pair.guest : undefined,
    host: revealed ? pair.host : undefined,
  });
});

module.exports = router;
