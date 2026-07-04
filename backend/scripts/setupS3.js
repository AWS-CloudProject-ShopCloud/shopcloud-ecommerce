/**
 * Script: setupS3.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates the S3 bucket for receipt storage.
 * Run ONCE during initial setup: npm run setup-s3
 */

import "dotenv/config";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_RECEIPTS_BUCKET || "ecommerce-receipts";
const REGION = process.env.AWS_REGION || "us-east-1";

async function setupS3() {
  console.log("════════════════════════════════════════════");
  console.log("    S3 Setup Script - E-Commerce Backend    ");
  console.log("════════════════════════════════════════════\n");
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${BUCKET_NAME}\n`);

  // 1. Check if bucket already exists
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ Bucket "${BUCKET_NAME}" already exists.`);
  } catch {
    // Bucket doesn't exist, create it
    console.log(`📦 Creating S3 bucket: "${BUCKET_NAME}"...`);
    const createParams = { Bucket: BUCKET_NAME };

    // us-east-1 does NOT use LocationConstraint
    if (REGION !== "us-east-1") {
      createParams.CreateBucketConfiguration = { LocationConstraint: REGION };
    }

    await s3.send(new CreateBucketCommand(createParams));
    console.log(`✅ Bucket "${BUCKET_NAME}" created successfully!`);
  }

  // 2. Block all public access (receipts are private)
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: BUCKET_NAME,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    })
  );
  console.log("✅ Public access blocked (receipts are private).");

  // 3. Set CORS policy for frontend access
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT"],
            AllowedOrigins: ["http://localhost:3000"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    })
  );
  console.log("✅ CORS policy configured.");

  console.log(`\n🎉 S3 setup complete! Bucket: s3://${BUCKET_NAME}`);
  console.log("   Receipts will be stored at: s3://${BUCKET_NAME}/receipts/<userId>/<receiptId>.json");
}

setupS3().catch((err) => {
  console.error("❌ S3 setup failed:", err);
  process.exit(1);
});
