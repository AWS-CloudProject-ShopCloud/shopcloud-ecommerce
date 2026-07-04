/**
 * AWS Lambda Function: ecommerce-process-purchase
 * ─────────────────────────────────────────────────────────────────────────────
 * This function is triggered by the Express backend (purchase route).
 * It processes a purchase by deducting inventory quantities in DynamoDB.
 *
 * DEPLOYMENT: Upload lambda/index.js to AWS Lambda (zip it first).
 * Runtime: Node.js 20.x
 * Handler: index.handler
 * Timeout: 30 seconds
 * Memory: 256 MB
 *
 * Required IAM Permissions:
 * - dynamodb:GetItem
 * - dynamodb:UpdateItem
 * - dynamodb:TransactWriteItems
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.DYNAMODB_PRODUCTS_TABLE || "ecommerce-products";

/**
 * Lambda Handler
 * @param {Object} event - Purchase payload from Express backend
 * @param {string} event.purchaseId - Unique purchase UUID
 * @param {string} event.userId - Cognito user sub
 * @param {string} event.userEmail - User email
 * @param {string} event.userName - User display name
 * @param {Array}  event.items - [{ productId, quantity, name, price }]
 * @param {string} event.timestamp - ISO timestamp
 */
export const handler = async (event) => {
  console.log("🛒 Processing purchase:", JSON.stringify(event, null, 2));

  const { purchaseId, userId, userEmail, userName, items, timestamp } = event;

  if (!items || items.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No items in purchase." }),
    };
  }

  const processedItems = [];
  let totalAmount = 0;

  // ─── Step 1: Verify inventory for ALL items before deducting ───────────────
  for (const item of items) {
    const product = await docClient.send(
      new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId: item.productId },
      })
    );

    if (!product.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Product not found: ${item.productId}` }),
      };
    }

    if (product.Item.quantity < item.quantity) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Insufficient stock for "${product.Item.name}". Available: ${product.Item.quantity}, Requested: ${item.quantity}`,
        }),
      };
    }

    processedItems.push({
      ...item,
      name: product.Item.name,
      price: product.Item.price,
      subtotal: product.Item.price * item.quantity,
    });

    totalAmount += product.Item.price * item.quantity;
  }

  // ─── Step 2: Deduct inventory for each item ────────────────────────────────
  for (const item of processedItems) {
    await docClient.send(
      new UpdateCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId: item.productId },
        UpdateExpression: "SET quantity = quantity - :qty, lastUpdated = :ts",
        ConditionExpression: "quantity >= :qty",
        ExpressionAttributeValues: {
          ":qty": item.quantity,
          ":ts": new Date().toISOString(),
        },
      })
    );

    console.log(
      `✅ Inventory updated: ${item.name} — deducted ${item.quantity} unit(s). New stock: ${item.quantity}`
    );
  }

  console.log(`✅ Purchase ${purchaseId} processed. Total: $${totalAmount.toFixed(2)}`);

  // ─── Step 3: Return result to calling backend ──────────────────────────────
  return {
    statusCode: 200,
    body: JSON.stringify({
      purchaseId,
      userId,
      userEmail,
      userName,
      processedItems,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      timestamp,
      status: "COMPLETED",
    }),
  };
};
