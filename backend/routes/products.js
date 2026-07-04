import express from "express";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/aws.js";

const router = express.Router();

// ─── GET /api/products ────────────────────────────────────────────────────────
// AWS DynamoDB: Scan all products
router.get("/", async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: TABLES.PRODUCTS,
      // Optional filter for only available products
      FilterExpression: "quantity > :minQty",
      ExpressionAttributeValues: {
        ":minQty": 0,
      },
    });

    const response = await dynamoDB.send(command);

    // Sort by category for better UX
    const products = (response.Items || []).sort((a, b) =>
      a.category.localeCompare(b.category)
    );

    return res.json({
      products,
      count: products.length,
      source: "AWS DynamoDB",
      table: TABLES.PRODUCTS,
    });
  } catch (error) {
    console.error("DynamoDB Scan Error:", error);
    return res.status(500).json({
      error: "Failed to fetch products from DynamoDB.",
      code: error.name,
    });
  }
});

// ─── GET /api/products/:id ────────────────────────────────────────────────────
// AWS DynamoDB: Get single product by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const command = new GetCommand({
      TableName: TABLES.PRODUCTS,
      Key: { productId: id },
    });

    const response = await dynamoDB.send(command);

    if (!response.Item) {
      return res.status(404).json({ error: "Product not found." });
    }

    return res.json({
      product: response.Item,
      source: "AWS DynamoDB",
    });
  } catch (error) {
    console.error("DynamoDB Get Error:", error);
    return res.status(500).json({
      error: "Failed to fetch product from DynamoDB.",
      code: error.name,
    });
  }
});

export default router;
