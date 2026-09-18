const axios = require("axios");

/**
 * Phase 3 — Regional Expansion. Once Kampala/Dar/Kigali launch, guests
 * there won't have M-Pesa Kenya; Flutterwave or Pesapal cover mobile
 * wallets across TZS/UGX/RWF from one integration instead of building a
 * bespoke one per country's telco. Stubbed for now — wire in whichever
 * aggregator you sign with first. Same graceful-mock pattern as M-Pesa
 * and WhatsApp: safe to leave uncredentialed until Phase 3 actually
 * starts.
 */

const hasFlutterwaveCredentials = () => Boolean(process.env.FLUTTERWAVE_SECRET_KEY);

async function chargeMobileMoney({ phone, amount, currency, network, txRef }) {
  // currency: "TZS" | "UGX" | "RWF"; network e.g. "MTN", "TIGO", "AIRTEL"
  if (!hasFlutterwaveCredentials()) {
    return {
      mock: true,
      status: "success",
      txRef,
      message: `Mocked ${currency} ${amount} charge to ${phone} via ${network} (mobile money)`,
    };
  }

  const { data } = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=mobile_money_franco",
    {
      tx_ref: txRef,
      amount,
      currency,
      network,
      phone_number: phone,
    },
    { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
  );
  return data;
}

module.exports = { chargeMobileMoney, hasFlutterwaveCredentials };
