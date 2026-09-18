require("dotenv").config();
const express = require("express");
const cors = require("cors");

const propertiesRoutes = require("./routes/properties");
const agentsRoutes = require("./routes/agents");
const bookingsRoutes = require("./routes/bookings");
const paymentsRoutes = require("./routes/payments");
const reviewsRoutes = require("./routes/reviews");
const partnersRoutes = require("./routes/partners");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", service: "solstice-backend" }));

app.use("/api/properties", propertiesRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/partners", partnersRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Solstice backend listening on port ${PORT}`);
});
