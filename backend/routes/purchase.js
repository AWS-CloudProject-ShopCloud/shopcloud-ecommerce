import express from "express";
import { GetCommand, UpdateCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { dynamoDB, lambda, s3, TABLES, S3_BUCKET } from "../config/aws.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ─── Helper: Validate token & get user (JWT) ─────────────────────────────────
function getUserFromToken(authHeader) {
  return verifyToken(authHeader); // throws on invalid token
}

// ─── POST /api/purchase ───────────────────────────────────────────────────────
// 1. Validate user via Cognito token
// 2. Invoke Lambda to process purchase (deduct inventory in DynamoDB)
// 3. Store receipt in S3
router.post("/", async (req, res) => {
  const { items } = req.body; // [{ productId, quantity, name, price }]

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart items are required." });
  }

  // Step 1: Authenticate user (JWT)
  let user;
  try {
    user = getUserFromToken(req.headers.authorization);
  } catch (err) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }

  // Step 2: Build purchase payload for Lambda
  const purchaseId = uuidv4();
  const purchaseTimestamp = new Date().toISOString();

  const lambdaPayload = {
    purchaseId,
    userId: user.sub,
    userEmail: user.email,
    userName: user.name,
    items,
    timestamp: purchaseTimestamp,
  };

  // Step 3: Invoke Lambda function (processes purchase + deducts DynamoDB inventory)
  try {
    const invokeCommand = new InvokeCommand({
      FunctionName: "ecommerce-process-purchase", // Lambda function name
      InvocationType: "RequestResponse",          // Synchronous
      Payload: Buffer.from(JSON.stringify(lambdaPayload)),
    });

    const lambdaResponse = await lambda.send(invokeCommand);
    const lambdaResult = JSON.parse(Buffer.from(lambdaResponse.Payload).toString());

    // Check Lambda returned success
    if (lambdaResponse.FunctionError || lambdaResult.statusCode !== 200) {
      const errBody = JSON.parse(lambdaResult.body || "{}");
      return res.status(400).json({
        error: errBody.error || "Purchase processing failed.",
        details: lambdaResult,
      });
    }

    const resultBody = JSON.parse(lambdaResult.body);

    // Step 4: Store receipt in S3
    const receipt = {
      receiptId: purchaseId,
      userId: user.sub,
      userEmail: user.email,
      userName: user.name,
      items: resultBody.processedItems || items,
      totalAmount: resultBody.totalAmount,
      purchaseDate: purchaseTimestamp,
      status: "COMPLETED",
    };

    const s3Key = `receipts/${user.sub}/${purchaseId}.json`;

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(receipt, null, 2),
        ContentType: "application/json",
        Metadata: {
          userId: user.sub,
          purchaseId,
        },
      })
    );

    console.log(`✅ Receipt stored in S3: s3://${S3_BUCKET}/${s3Key}`);

    return res.json({
      success: true,
      message: "Purchase completed successfully!",
      receiptId: purchaseId,
      receipt,
      s3Location: `s3://${S3_BUCKET}/${s3Key}`,
    });
  } catch (error) {
    console.error("Purchase processing error:", error);
    return res.status(500).json({
      error: "Failed to process purchase.",
      code: error.name,
      message: error.message,
    });
  }
});

export default router;
