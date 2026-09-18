/**
 * Host-Only Commission model: guests pay 0% platform fee (keeps the price
 * they see clean); the host's commission is the entire take-rate.
 *
 * The 12%/15% split isn't arbitrary — it's the incentive that ties the
 * Photography & Verification add-on to the "hyper-vetted trust" pitch:
 * a host who lets Solstice's own photographer visit and shoot the
 * property pays less commission on every future booking. That's a
 * stronger nudge toward getting verified than charging for the photos
 * alone would be.
 */

const BASE_RATE = Number(process.env.HOST_COMMISSION_BASE || 15); // %
const PHOTOGRAPHED_RATE = Number(process.env.HOST_COMMISSION_PHOTOGRAPHED || 12); // %

function rateForListing(listing) {
  return listing?.photographed ? PHOTOGRAPHED_RATE : BASE_RATE;
}

/**
 * @param {number} price - the guest-facing price (0% guest fee, so this
 *   is exactly what the guest pays)
 * @param {{ photographed?: boolean }} listing
 */
function computeSplit(price, listing) {
  const rate = rateForListing(listing);
  const commission = Math.round(price * (rate / 100));
  return {
    rate,
    guestPays: price, // unchanged — the whole point of Host-Only Commission
    platformCommission: commission,
    hostPayout: price - commission,
  };
}

module.exports = { BASE_RATE, PHOTOGRAPHED_RATE, rateForListing, computeSplit };
