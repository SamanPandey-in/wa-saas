require("dotenv").config();

const express = require("express");

const app = express();
const port = process.env.AUTOMATION_PORT || 4001;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "automation" });
});

app.listen(port, () => {
  console.log(`Automation service listening on port ${port}`);
});
