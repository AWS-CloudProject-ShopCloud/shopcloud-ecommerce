# ShopCloud — AWS E-Commerce Project (P2)

> A cloud-native e-commerce application built with Node.js/Express using real **AWS SDK v3** services, developed for the AWS Cloud Practitioner course project.

---

## AWS Services Used

| Service | How It Is Used |
|---------|----------------|
| 🔐 **Amazon Cognito** | User registration & login — creates real user accounts in a Cognito User Pool, issues JWT access tokens |
| 🗄 **Amazon DynamoDB** | Stores the product catalog (8 items) and tracks live inventory quantities |
| ⚡ **AWS Lambda** | Serverless purchase processor — verifies stock and deducts inventory atomically |
| 📦 **Amazon S3** | Stores each customer's digital receipt as a JSON file, retrieved on demand |
| 🖥 **Amazon EC2** | The Node.js/Express web server that hosts the frontend and routes all API calls to AWS services |

---

## Architecture

```
Browser (Frontend)
      │
      ▼
EC2 — Express Server (localhost:3000)
      │
      ├──▶ Cognito ──────── Register / Login / Verify Token
      ├──▶ DynamoDB ─────── Read products, check inventory
      ├──▶ Lambda ──────────Invoked on purchase → deducts DynamoDB stock
      └──▶ S3 ─────────────Store & retrieve JSON receipts
```

---

## Project Structure

```
AWS Cloud Practitioner Project/
├── frontend/                  # Static HTML/CSS/JS (served by EC2/Express)
│   ├── index.html             # Login & Register (Cognito)
│   ├── products.html          # Product catalog (DynamoDB)
│   ├── cart.html              # Cart + purchase (Lambda)
│   ├── receipt.html           # Order history (S3)
│   ├── css/style.css          # Global design system
│   └── js/                    # Page-specific JavaScript
│       ├── auth.js
│       ├── products.js
│       ├── cart.js
│       └── receipt.js
├── backend/                   # Express.js server (EC2)
│   ├── server.js              # Entry point
│   ├── config/aws.js          # All AWS SDK clients
│   ├── routes/
│   │   ├── auth.js            # Cognito: register, login, me, logout
│   │   ├── products.js        # DynamoDB: list & get products
│   │   ├── cart.js            # DynamoDB: validate cart stock
│   │   ├── purchase.js        # Invokes Lambda + stores receipt in S3
│   │   └── receipt.js         # S3: list & fetch receipts
│   ├── middleware/auth.js      # JWT decoder for protected routes
│   └── scripts/
│       ├── seedDynamoDB.js    # Creates + seeds product table
│       └── setupS3.js         # Creates S3 receipts bucket
├── lambda/
│   └── index.mjs              # Lambda function code (upload to AWS)
├── README.md
├── STARTING_NEW_LAB_SESSION.md
└── VIDEO_RECORDING_GUIDE.md
```

---

## Setup — AWS Academy Learner Lab

> ⚠️ **Starting a new lab session?** Follow [`STARTING_NEW_LAB_SESSION.md`](STARTING_NEW_LAB_SESSION.md) to reset all AWS resources quickly.

### Step 1: Update Credentials

1. In Vocareum / Canvas → **AWS Details → Show**
2. Copy `aws_access_key_id`, `aws_secret_access_key`, and `aws_session_token`
3. Open `backend/.env` and paste the new values

```env
AWS_ACCESS_KEY_ID=ASIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

### Step 2: Create Cognito User Pool

1. AWS Console → **Cognito** → **Create user pool**
2. **Authentication providers** → Cognito user pool → sign-in: **Email**
3. Password policy → Cognito defaults (keep as is)
4. **MFA** → No MFA
5. **Email** → Send email with Cognito (no SES needed)
6. **App type** → Public client → **No client secret**
7. Name the pool: `shopcloud-users`
8. After creation, copy:
   - **User Pool ID** → paste in `.env` as `COGNITO_USER_POOL_ID`
   - **App client ID** → paste in `.env` as `COGNITO_CLIENT_ID`
9. Go to App client → **Edit** → Enable **USER_PASSWORD_AUTH** flow → Save

### Step 3: Seed DynamoDB and Create S3 Bucket

```bash
cd backend
npm install          # first time only
npm run seed         # creates ecommerce-products table with 8 items
npm run setup-s3     # creates ecommerce-receipts-devraj2026 bucket
```

### Step 4: Deploy the Lambda Function

1. AWS Console → **Lambda** → **Create function**
2. **Name**: `ecommerce-process-purchase`
3. **Runtime**: Node.js 20.x
4. **Execution role**: Use existing role → `LabRole`
5. Paste code from `lambda/index.mjs` into the editor → **Deploy**
6. **Configuration** → Environment variables → Add:
   - `DYNAMODB_PRODUCTS_TABLE` = `ecommerce-products`
7. Save

### Step 5: Start the Server

```bash
cd backend
npm start
```

Open **http://localhost:3000** in your browser.

---

## User Flow

```
1.  Register → Cognito creates user account → auto-confirmed
2.  Login    → Cognito issues JWT access token
3.  Products → DynamoDB returns live catalog with stock counts
4.  Cart     → Add items, quantities validated against DynamoDB
5.  Purchase → Express invokes Lambda → Lambda deducts inventory in DynamoDB
              → Receipt JSON written to S3
6.  Receipts → S3 receipts listed and retrieved for the logged-in user
```

---

## API Endpoints

| Method | Endpoint | AWS Service | Description |
|--------|----------|-------------|-------------|
| POST | `/api/auth/register` | **Cognito** | Create user in Cognito User Pool |
| POST | `/api/auth/login` | **Cognito** | Authenticate, return JWT tokens |
| GET | `/api/auth/me` | **Cognito** | Verify token via Cognito GetUser |
| POST | `/api/auth/logout` | **Cognito** | Global sign-out from Cognito |
| GET | `/api/products` | **DynamoDB** | List all products with stock |
| GET | `/api/products/:id` | **DynamoDB** | Single product detail |
| POST | `/api/cart/validate` | **DynamoDB** | Validate cart stock levels |
| POST | `/api/purchase` | **Lambda + S3** | Process purchase via Lambda |
| GET | `/api/receipt` | **S3** | List user's receipts from S3 |
| GET | `/api/receipt/:id` | **S3** | Fetch a specific receipt from S3 |
| GET | `/api/health` | — | Server health check |

---

## Tech Stack

- **Runtime**: Node.js 20 + ES Modules
- **Server**: Express.js
- **AWS SDK**: `@aws-sdk/client-*` v3
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Auth**: AWS Cognito (USER_PASSWORD_AUTH flow)
