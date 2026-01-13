import express from "express";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { generatePdf } from "./pdf/render.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, "../public")));

// Health check
app.get("/health", (req, res) => {
  res.send("OK");
});

// PDF generation endpoint
app.post("/api/generate", upload.any(), async (req, res) => {
  try {
    const pdfBuffer = await generatePdf(req.body, req.files);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF Generation Error:", err);
    res.status(500).send(err.toString());
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Finance Memo Generator running on port ${PORT}`);
});
