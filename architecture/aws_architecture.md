# AWS Architecture — E-Commerce Backend (Project P2)

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                                    │
│   ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌────────────────┐  │
│   │ index.html│   │products.html │   │ cart.html│   │ receipt.html   │  │
│   │ (Login)  │   │ (Catalog)    │   │  (Cart)  │   │ (Receipts)     │  │
│   └────┬─────┘   └──────┬───────┘   └────┬─────┘   └──────┬─────────┘  │
└────────┼────────────────┼────────────────┼────────────────┼─────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      AWS EC2 (Express.js Server)                          │
│                    Hosts the frontend & API routes                        │
│                      http://localhost:3000                                │
│                                                                           │
│   /api/auth/*    /api/products/*    /api/purchase    /api/receipt/*       │
└──────┬─────────────────┬────────────────┬────────────────┬───────────────┘
       │                 │                │                │
       ▼                 ▼                ▼                ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  AWS Cognito│  │  AWS DynamoDB│  │  AWS Lambda  │  │   AWS S3     │
│             │  │              │  │              │  │              │
│ User Pool   │  │ ecommerce-   │  │ ecommerce-   │  │ ecommerce-   │
│             │  │ products     │  │ process-     │  │ receipts     │
│ ✅ SignUp   │  │              │  │ purchase     │  │ bucket       │
│ ✅ Login    │  │ ✅ List all  │  │              │  │              │
│ ✅ Confirm  │  │   products   │  │ ✅ Validates │  │ ✅ Stores    │
│ ✅ GetUser  │  │ ✅ Get by ID │  │   inventory  │  │   receipts   │
│ ✅ Logout   │  │ ✅ Update    │  │ ✅ Deducts   │  │ ✅ Retrieves │
│             │  │   inventory  │  │   DynamoDB   │  │   receipts   │
│             │  │   (on buy)   │  │   stock      │  │ ✅ Lists per │
│             │  │              │  │ ✅ Returns   │  │   user       │
│             │  │              │  │   purchase   │  │              │
└─────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## AWS Services Explained

### 1. 🖥 Amazon EC2 (Elastic Compute Cloud)
**Role:** Hosts the web server (Express.js) and serves the frontend HTML/CSS/JS.

- **What it does**: Acts as the application server. In this project, the Express.js backend runs on EC2.
- **Simulation**: Running `node server.js` simulates what happens on an EC2 instance.
- **In production**: You'd SSH into an EC2 instance and run the server there (or use a process manager like PM2).

---

### 2. 🔐 Amazon Cognito
**Role:** Handles all user authentication — register, verify email, login, and session management.

**Flow:**
```
User Registers → Cognito sends OTP to email → User verifies → User can log in
User Logs In  → Cognito returns JWT Tokens (AccessToken, IdToken, RefreshToken)
API calls     → AccessToken sent in Authorization header → Cognito validates
```

**Why Cognito?**
- You don't store passwords — Cognito handles it securely.
- Provides industry-standard JWT tokens.
- Supports MFA, social login, and more.

**API used:** `CognitoIdentityProviderClient` from AWS SDK v3
- `SignUpCommand` — Create new user
- `ConfirmSignUpCommand` — Verify email OTP
- `InitiateAuthCommand` — Login (USER_PASSWORD_AUTH flow)
- `GetUserCommand` — Get logged-in user info from token
- `GlobalSignOutCommand` — Logout

---

### 3. 🗄 Amazon DynamoDB
**Role:** NoSQL database storing product information and inventory.

**Table: `ecommerce-products`**
| Attribute   | Type   | Description              |
|-------------|--------|--------------------------|
| productId   | String | Primary Key (Hash Key)   |
| name        | String | Product name             |
| description | String | Product description      |
| price       | Number | Product price (USD)      |
| category    | String | Category label           |
| quantity    | Number | Inventory count          |
| rating      | Number | Star rating              |
| brand       | String | Brand name               |

**Why DynamoDB?**
- Serverless, infinitely scalable NoSQL database.
- Single-digit millisecond response times.
- Pay-per-request billing mode — no capacity planning needed.

**Operations used:**
- `ScanCommand` — List all products
- `GetCommand` — Get a single product
- `UpdateCommand` (in Lambda) — Deduct inventory after purchase

---

### 4. ⚡ AWS Lambda
**Role:** Serverless function that processes purchases.

**Function: `ecommerce-process-purchase`**

**Trigger:** Called by the EC2 Express server via `InvokeCommand` when a user clicks "Complete Purchase".

**What it does:**
1. Receives the purchase payload (user info + cart items)
2. Validates inventory for ALL items (prevents overselling)
3. Atomically deducts quantity from DynamoDB for each item
4. Returns processed order details

**Why Lambda?**
- Serverless — no server management, auto-scales instantly.
- Cost-efficient — pay only for actual execution time.
- Perfect for event-driven tasks like processing purchases.
- Isolates the critical purchase logic from the web server.

---

### 5. 📦 Amazon S3 (Simple Storage Service)
**Role:** Stores digital purchase receipts as JSON files.

**Bucket: `ecommerce-receipts-xxxxxxxx`**

**File structure:**
```
s3://ecommerce-receipts/
└── receipts/
    └── {userId}/
        └── {receiptId}.json
```

**Receipt JSON structure:**
```json
{
  "receiptId": "uuid-v4",
  "userId": "cognito-user-sub",
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "items": [...],
  "totalAmount": 129.99,
  "purchaseDate": "2024-01-15T10:30:00.000Z",
  "status": "COMPLETED"
}
```

**Why S3?**
- Infinitely scalable object storage.
- 99.999999999% (11 nines) durability.
- Cost-effective — pay only for what you store.
- Easy retrieval with unique keys.

---

## Complete Purchase Flow

```
1. User clicks "Complete Purchase"
   │
   ▼
2. Frontend sends POST /api/purchase with cart + Bearer token
   │
   ▼
3. EC2 (Express) validates Cognito token → GetUserCommand
   │
   ▼
4. EC2 invokes Lambda → InvokeCommand("ecommerce-process-purchase")
   │
   ▼
5. Lambda checks DynamoDB inventory for each item
   │
   ├── If insufficient stock → Return error → EC2 sends 400 to frontend
   │
   └── If all stock available:
       │
       ▼
6.    Lambda deducts quantities in DynamoDB → UpdateCommand (conditional)
       │
       ▼
7.    Lambda returns success + processed items to EC2
       │
       ▼
8. EC2 generates receipt JSON and stores it in S3 → PutObjectCommand
   │
   ▼
9. EC2 returns success + receiptId to frontend
   │
   ▼
10. Frontend clears cart, redirects to Receipt page
    │
    ▼
11. Receipt page fetches from S3 → GetObjectCommand → Displays receipt
```

---

## Security Considerations

| Concern | Solution |
|---------|----------|
| Passwords | Never stored — handled by Cognito |
| API Authorization | Bearer JWT token on every API call |
| Receipts | Private S3 bucket, per-user prefix |
| Inventory race conditions | DynamoDB conditional update (`quantity >= :qty`) |
| CORS | Restricted to localhost in development |
