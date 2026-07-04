import express from "express";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "../config/aws.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ─── Helper: stream to string ───────────────────────────────────────────────
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

// ─── Helper: Get user sub from JWT token ─────────────────────────────────
function getUserSub(authHeader) {
  const user = verifyToken(authHeader); // throws on invalid token
  return user.sub;
}

// ─── GET /api/receipt/:receiptId ──────────────────────────────────────────────
// AWS S3: Retrieve a specific receipt JSON
router.get("/:receiptId", async (req, res) => {
  const { receiptId } = req.params;

  let userSub;
  try {
    userSub = getUserSub(req.headers.authorization);
  } catch {
    return res.status(401).json({ error: "Authentication required." });
  }

  const s3Key = `receipts/${userSub}/${receiptId}.json`;

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });

    const response = await s3.send(command);
    const bodyString = await streamToString(response.Body);
    const receipt = JSON.parse(bodyString);

    return res.json({
      receipt,
      source: "AWS S3",
      bucket: S3_BUCKET,
      key: s3Key,
    });
  } catch (error) {
    if (error.name === "NoSuchKey") {
      return res.status(404).json({ error: "Receipt not found." });
    }
    console.error("S3 GetObject Error:", error);
    return res.status(500).json({
      error: "Failed to retrieve receipt from S3.",
      code: error.name,
    });
  }
});

// ─── GET /api/receipt (list all receipts for current user) ───────────────────
router.get("/", async (req, res) => {
  let userSub;
  try {
    userSub = getUserSub(req.headers.authorization);
  } catch {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: `receipts/${userSub}/`,
    });

    const response = await s3.send(command);
    const receiptKeys = (response.Contents || []).map((obj) => ({
      receiptId: obj.Key.split("/").pop().replace(".json", ""),
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
    }));

    return res.json({
      receipts: receiptKeys,
      count: receiptKeys.length,
      source: "AWS S3",
    });
  } catch (error) {
    console.error("S3 ListObjects Error:", error);
    return res.status(500).json({
      error: "Failed to list receipts from S3.",
      code: error.name,
    });
  }
});

export default router;
