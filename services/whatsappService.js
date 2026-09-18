const axios = require("axios");

/**
 * WhatsApp Business (Meta Cloud API) wrapper.
 * The frontend's "Message agent" button uses a plain wa.me deep link and
 * needs no backend at all — this service is for the parts that do need
 * the backend: automated notifications ("your deposit was received",
 * "your listing was verified") sent from Solstice's own number.
 */

const hasCredentials = () =>
  Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

async function sendTextMessage(toPhone, body) {
  if (!hasCredentials()) {
    return { mock: true, to: toPhone, body, status: "queued (mocked)" };
  }

  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const { data } = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body },
    },
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
  );
  return data;
}

/**
 * The "Direct WhatsApp Pipeline" differentiation: confirmation details,
 * house rules, and the host's contact go straight to the guest's
 * WhatsApp thread instead of requiring an app login or an email check —
 * the thing global platforms make travelers do on precious data bundles.
 */
async function sendBookingConfirmation(guestPhone, booking) {
  const body =
    `Solstice booking ${booking.id} confirmed ✅\n` +
    `Check-in: ${booking.checkIn || "as agreed with host"}\n` +
    `Your deposit is held in escrow and released to the host 24h after check-in.\n` +
    `House rules and the host's number will follow in this chat.`;
  return sendTextMessage(guestPhone, body);
}

module.exports = { sendTextMessage, sendBookingConfirmation, hasCredentials };
