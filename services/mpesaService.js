const axios = require("axios");

/**
 * Thin wrapper around Safaricom's Daraja API.
 * Mirrors the pattern used in the Safina backend: every integration
 * degrades gracefully to a mock response when credentials are absent,
 * so the rest of the app can be built and demoed before Daraja
 * onboarding is complete.
 */

const hasCredentials = () =>
  Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_PASSKEY);

const BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return data.access_token;
}

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/**
 * Initiate an STK push for a reservation deposit or full payment.
 * @param {{ phone: string, amount: number, accountRef: string, description: string }} params
 */
async function stkPush({ phone, amount, accountRef, description }) {
  if (!hasCredentials()) {
    // Mock path — lets frontend and product flows be built/demoed
    // before Daraja sandbox/production credentials exist.
    return {
      mock: true,
      MerchantRequestID: "mock-merchant-req",
      CheckoutRequestID: `mock-${Date.now()}`,
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing (mocked)",
      CustomerMessage: "Success. Request accepted for processing (mocked)",
    };
  }

  const token = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE;
  const timestamp = timestampNow();
  const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${timestamp}`).toString(
    "base64"
  );

  const { data } = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountRef,
      TransactionDesc: description,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data;
}

/**
 * Pay a host (after the 24h escrow hold) or a partner (airport transfer,
 * cleaning) via Daraja's B2C API. Mocks the same way stkPush does when
 * credentials are absent, so payouts can be demoed before B2C is
 * provisioned with Safaricom (a separate, slower approval than STK Push).
 */
async function b2cPayout(phone, amount, remarks = "Solstice payout") {
  if (!hasCredentials()) {
    return {
      mock: true,
      ConversationID: `mock-conv-${Date.now()}`,
      OriginatorConversationID: `mock-orig-${Date.now()}`,
      ResponseCode: "0",
      ResponseDescription: `Accept the service request successfully (mocked) — KES ${amount} to ${phone}: ${remarks}`,
    };
  }

  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE_URL}/mpesa/b2c/v1/paymentrequest`,
    {
      InitiatorName: process.env.MPESA_INITIATOR_NAME,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: amount,
      PartyA: process.env.MPESA_SHORTCODE,
      PartyB: phone,
      Remarks: remarks,
      QueueTimeOutURL: process.env.MPESA_B2C_TIMEOUT_URL,
      ResultURL: process.env.MPESA_B2C_RESULT_URL,
      Occasion: "Solstice payout",
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

module.exports = { stkPush, b2cPayout, hasCredentials };
