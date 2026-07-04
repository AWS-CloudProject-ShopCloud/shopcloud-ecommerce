import "dotenv/config";
import { DynamoDBClient, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, DeleteBucketCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const awsConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
  },
};

const ddbClient = new DynamoDBClient(awsConfig);
const s3Client = new S3Client(awsConfig);

const TABLE_NAME = process.env.DYNAMODB_PRODUCTS_TABLE || "ecommerce-products";
const BUCKET_NAME = process.env.S3_RECEIPTS_BUCKET || "ecommerce-receipts-devraj2026";

async function cleanup() {
  console.log("🧹 Cleaning up AWS resources...");

  // 1. Delete DynamoDB Table
  try {
    console.log(`Deleting DynamoDB table "${TABLE_NAME}"...`);
    await ddbClient.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
    console.log(`✅ Table "${TABLE_NAME}" deleted successfully.`);
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.log(`ℹ️ Table "${TABLE_NAME}" does not exist.`);
    } else {
      console.error(`❌ Failed to delete DynamoDB table:`, err.message);
    }
  }

  // 2. Delete S3 Bucket
  try {
    console.log(`Deleting S3 bucket "${BUCKET_NAME}"...`);
    
    // Empty bucket first (if any objects exist)
    try {
      const list = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
      if (list.Contents && list.Contents.length > 0) {
        const deleteParams = {
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: list.Contents.map((obj) => ({ Key: obj.Key })),
          },
        };
        await s3Client.send(new DeleteObjectsCommand(deleteParams));
        console.log(`Deleted objects from bucket.`);
      }
    } catch (e) {
      // Ignore if bucket doesn't exist
    }

    await s3Client.send(new DeleteBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ S3 bucket "${BUCKET_NAME}" deleted successfully.`);
  } catch (err) {
    if (err.name === "NoSuchBucket") {
      console.log(`ℹ️ Bucket "${BUCKET_NAME}" does not exist.`);
    } else {
      console.error(`❌ Failed to delete S3 bucket:`, err.message);
    }
  }
  
  console.log("🎉 Cleanup complete!");
}

cleanup();
