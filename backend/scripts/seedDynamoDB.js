/**
 * Script: seedDynamoDB.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates the DynamoDB "ecommerce-products" table and seeds it with
 * sample product data. Run this ONCE during initial setup.
 *
 * Usage: npm run seed
 */

import "dotenv/config";
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_PRODUCTS_TABLE || "ecommerce-products";

// ─── Sample Products ──────────────────────────────────────────────────────────
const products = [
  {
    productId: "prod-001",
    name: "AWS Certified Cloud Practitioner Study Guide",
    description: "Comprehensive guide for the AWS Cloud Practitioner exam with practice tests.",
    price: 39.99,
    category: "Books",
    imageUrl: "https://placehold.co/400x300?text=Study+Guide",
    quantity: 150,
    rating: 4.8,
    brand: "AWS Press",
  },
  {
    productId: "prod-002",
    name: "Mechanical Gaming Keyboard RGB",
    description: "Professional mechanical keyboard with Cherry MX switches and full RGB backlighting.",
    price: 129.99,
    category: "Electronics",
    imageUrl: "https://placehold.co/400x300?text=Keyboard",
    quantity: 45,
    rating: 4.6,
    brand: "TechPro",
  },
  {
    productId: "prod-003",
    name: "4K Ultra-Wide Monitor 34\"",
    description: "34-inch curved 4K ultra-wide display with 144Hz refresh rate for ultimate productivity.",
    price: 699.99,
    category: "Electronics",
    imageUrl: "https://placehold.co/400x300?text=Monitor",
    quantity: 20,
    rating: 4.9,
    brand: "ViewMaster",
  },
  {
    productId: "prod-004",
    name: "Noise-Cancelling Wireless Headphones",
    description: "Premium over-ear headphones with 40-hour battery life and active noise cancellation.",
    price: 249.99,
    category: "Electronics",
    imageUrl: "https://placehold.co/400x300?text=Headphones",
    quantity: 60,
    rating: 4.7,
    brand: "SoundWave",
  },
  {
    productId: "prod-005",
    name: "Ergonomic Office Chair",
    description: "Lumbar-support adjustable office chair with breathable mesh and armrest adjustment.",
    price: 379.99,
    category: "Furniture",
    imageUrl: "https://placehold.co/400x300?text=Chair",
    quantity: 30,
    rating: 4.5,
    brand: "ErgoComfort",
  },
  {
    productId: "prod-006",
    name: "Portable SSD 2TB",
    description: "Ultra-fast USB-C portable SSD with 1050MB/s read speed and military-grade drop resistance.",
    price: 189.99,
    category: "Storage",
    imageUrl: "https://placehold.co/400x300?text=SSD",
    quantity: 80,
    rating: 4.8,
    brand: "FlashDrive Pro",
  },
  {
    productId: "prod-007",
    name: "Smart Webcam 4K",
    description: "4K AI-powered webcam with auto-framing, noise reduction microphone, and HDR.",
    price: 149.99,
    category: "Electronics",
    imageUrl: "https://placehold.co/400x300?text=Webcam",
    quantity: 55,
    rating: 4.4,
    brand: "ClearVision",
  },
  {
    productId: "prod-008",
    name: "USB-C Hub 12-in-1",
    description: "Docking station with HDMI, DisplayPort, USB-A, USB-C, SD card, Ethernet and more.",
    price: 89.99,
    category: "Accessories",
    imageUrl: "https://placehold.co/400x300?text=USB+Hub",
    quantity: 100,
    rating: 4.3,
    brand: "ConnectAll",
  },
];

// ─── Create Table ─────────────────────────────────────────────────────────────
async function createTable() {
  try {
    // Check if table already exists
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`✅ Table "${TABLE_NAME}" already exists. Skipping creation.`);
    return;
  } catch {
    console.log(`📦 Creating DynamoDB table: "${TABLE_NAME}"...`);
  }

  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [{ AttributeName: "productId", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "productId", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST", // On-demand pricing (no capacity planning needed)
    })
  );

  // Wait for table to be active
  console.log("⏳ Waiting for table to become ACTIVE...");
  let status = "CREATING";
  while (status !== "ACTIVE") {
    await new Promise((r) => setTimeout(r, 2000));
    const desc = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    status = desc.Table.TableStatus;
    console.log(`   Status: ${status}`);
  }
  console.log(`✅ Table "${TABLE_NAME}" is now ACTIVE!\n`);
}

// ─── Seed Products ────────────────────────────────────────────────────────────
async function seedProducts() {
  console.log(`🌱 Seeding ${products.length} products into DynamoDB...`);

  for (const product of products) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: product,
      })
    );
    console.log(`   ✅ Added: ${product.name}`);
  }

  console.log(`\n🎉 Done! ${products.length} products seeded successfully.`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("════════════════════════════════════════════");
  console.log("  DynamoDB Seed Script - E-Commerce Backend ");
  console.log("════════════════════════════════════════════\n");
  console.log(`Region: ${process.env.AWS_REGION}`);
  console.log(`Table:  ${TABLE_NAME}\n`);

  await createTable();
  await seedProducts();
}

main().catch((err) => {
  console.error("❌ Seed script failed:", err);
  process.exit(1);
});
