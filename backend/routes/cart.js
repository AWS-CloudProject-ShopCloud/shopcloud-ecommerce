import express from "express";

const router = express.Router();

// Cart is managed client-side (localStorage), but we expose endpoints
// for server-side validation if needed.

// ─── POST /api/cart/validate ──────────────────────────────────────────────────
// Validate cart items still have sufficient inventory in DynamoDB
router.post("/validate", async (req, res) => {
  const { items } = req.body; // [{ productId, quantity }]

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Cart items array is required." });
  }

  try {
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const { dynamoDB, TABLES } = await import("../config/aws.js");

    const validationResults = await Promise.all(
      items.map(async (item) => {
        const command = new GetCommand({
          TableName: TABLES.PRODUCTS,
          Key: { productId: item.productId },
        });
        const response = await dynamoDB.send(command);
        const product = response.Item;

        if (!product) {
          return { productId: item.productId, valid: false, reason: "Product not found" };
        }

        if (product.quantity < item.quantity) {
          return {
            productId: item.productId,
            valid: false,
            reason: `Only ${product.quantity} units available`,
            availableQuantity: product.quantity,
          };
        }

        return { productId: item.productId, valid: true, price: product.price };
      })
    );

    const allValid = validationResults.every((r) => r.valid);

    return res.json({
      valid: allValid,
      items: validationResults,
    });
  } catch (error) {
    console.error("Cart validation error:", error);
    return res.status(500).json({ error: "Cart validation failed.", code: error.name });
  }
});

export default router;
