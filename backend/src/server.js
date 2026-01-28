require("dotenv").config();
const express = require("express");
const cors = require("cors");

const invoiceRoutes = require("./routes/invoices");
const exportRoutes = require("./routes/exports");

const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);

app.use("/api/invoices", invoiceRoutes);
app.use("/api/exports", exportRoutes);

// error handler sederhana
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Internal Server Error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));