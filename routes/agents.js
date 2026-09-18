const express = require("express");
const router = express.Router();

let agents = [
  {
    id: "A-01",
    name: "Wanjiru M.",
    agency: "Nyumba Bora Agents",
    phone: "0712345678",
    verifiedPhone: true,
    listingsCount: 14,
    rating: 4.8,
  },
];

// GET /api/agents/:id — public agent profile shown on a listing
router.get("/:id", (req, res) => {
  const agent = agents.find((a) => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json(agent);
});

// POST /api/agents — onboard a new agent/middleman (the WhatsApp brokers)
router.post("/", (req, res) => {
  const { name, agency, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });
  const agent = {
    id: `A-${String(agents.length + 1).padStart(2, "0")}`,
    name,
    agency: agency || "Independent agent",
    phone,
    verifiedPhone: false, // flip true once an OTP/verification step passes
    listingsCount: 0,
    rating: null,
  };
  agents.push(agent);
  res.status(201).json(agent);
});

module.exports = router;
