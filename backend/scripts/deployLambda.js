/**
 * Script: deployLambda.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Zips the Lambda function code and deploys it to AWS Lambda.
 * Creates or updates the function "ecommerce-process-purchase".
 *
 * Usage: npm run deploy-lambda
 * Prerequisites: npm install -g archiver (or it's installed as dev dependency)
 */

import "dotenv/config";
import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
  AddPermissionCommand,
} from "@aws-sdk/client-lambda";
import { IAMClient, GetRoleCommand } from "@aws-sdk/client-iam";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import archiver from "archiver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const FUNCTION_NAME = "ecommerce-process-purchase";
const LAMBDA_ROLE_ARN = process.env.LAMBDA_ROLE_ARN; // IAM Role for Lambda execution

async function zipLambda() {
  const lambdaDir = path.join(__dirname, "..", "..", "lambda");
  const zipPath = path.join(__dirname, "lambda-package.zip");

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`✅ Lambda zipped: ${archive.pointer()} bytes → ${zipPath}`);
      resolve(zipPath);
    });

    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(lambdaDir, false);
    archive.finalize();
  });
}

async function deployLambda() {
  console.log("════════════════════════════════════════════════════");
  console.log("    Lambda Deploy Script - E-Commerce Backend       ");
  console.log("════════════════════════════════════════════════════\n");

  if (!LAMBDA_ROLE_ARN) {
    console.error("❌ LAMBDA_ROLE_ARN not set in .env!");
    console.log("   Create an IAM role with DynamoDB access and set its ARN.");
    process.exit(1);
  }

  // 1. Zip the lambda code
  const zipPath = await zipLambda();
  const zipBuffer = fs.readFileSync(zipPath);

  // 2. Check if function exists
  let functionExists = false;
  try {
    await lambdaClient.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    functionExists = true;
  } catch { /* Function doesn't exist */ }

  if (functionExists) {
    // Update existing function
    console.log(`🔄 Updating Lambda function: "${FUNCTION_NAME}"...`);
    await lambdaClient.send(
      new UpdateFunctionCodeCommand({
        FunctionName: FUNCTION_NAME,
        ZipFile: zipBuffer,
      })
    );
    console.log(`✅ Lambda function updated!`);
  } else {
    // Create new function
    console.log(`🚀 Creating Lambda function: "${FUNCTION_NAME}"...`);
    await lambdaClient.send(
      new CreateFunctionCommand({
        FunctionName: FUNCTION_NAME,
        Runtime: "nodejs20.x",
        Handler: "index.handler",
        Role: LAMBDA_ROLE_ARN,
        Code: { ZipFile: zipBuffer },
        Description: "Processes e-commerce purchases and deducts DynamoDB inventory",
        Timeout: 30,
        MemorySize: 256,
        Environment: {
          Variables: {
            AWS_REGION: process.env.AWS_REGION,
            DYNAMODB_PRODUCTS_TABLE: process.env.DYNAMODB_PRODUCTS_TABLE,
          },
        },
      })
    );
    console.log(`✅ Lambda function created!`);
  }

  // Clean up zip
  fs.unlinkSync(zipPath);
  console.log(`\n🎉 Lambda deployment complete!`);
  console.log(`   Function: ${FUNCTION_NAME}`);
  console.log(`   Region:   ${process.env.AWS_REGION}`);
}

deployLambda().catch((err) => {
  console.error("❌ Lambda deployment failed:", err);
  process.exit(1);
});
