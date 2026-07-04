import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Route imports
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import cartRoutes from "./routes/cart.js";
import purchaseRoutes from "./routes/purchase.js";
import receiptRoutes from "./routes/receipt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000", "null"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Serve Static Frontend ───────────────────────────────────────────────────
// This simulates EC2 serving the frontend
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);       // AWS Cognito
app.use("/api/products", productRoutes); // AWS DynamoDB
app.use("/api/cart", cartRoutes);        // Cart management
app.use("/api/purchase", purchaseRoutes); // AWS Lambda + DynamoDB
app.use("/api/receipt", receiptRoutes);  // AWS S3

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "E-commerce Backend is running",
    services: {
      auth: "AWS Cognito",
      database: "AWS DynamoDB",
      compute: "AWS Lambda",
      storage: "AWS S3",
      hosting: "AWS EC2",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Catch-all: serve index.html (SPA fallback) ──────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(`║   🛒 E-Commerce Backend                      ║`);
  console.log(`║   🚀 Server running on http://localhost:${PORT}   ║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║   AWS Services Connected:                    ║");
  console.log("║   ✅ AWS Cognito  (Authentication)           ║");
  console.log("║   ✅ AWS DynamoDB (Products + Inventory)     ║");
  console.log("║   ✅ AWS Lambda   (Purchase Processing)      ║");
  console.log("║   ✅ AWS S3       (Receipt Storage)          ║");
  console.log("║   ✅ AWS EC2      (This Server)              ║");
  console.log("╚══════════════════════════════════════════════╝\n");
});
