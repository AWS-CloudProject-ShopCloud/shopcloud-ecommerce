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

```text
Browser (Frontend)
      │
      ▼
EC2 — Express Server (Port 3000)
      │
      ├──▶ Cognito ──────── Register / Login / Verify Token
      ├──▶ DynamoDB ─────── Read products, check inventory
      ├──▶ Lambda ──────────Invoked on purchase → deducts DynamoDB stock
      └──▶ S3 ─────────────Store & retrieve JSON receipts
```

---

## Project Structure

```text
AWS Cloud Practitioner Project/
├── frontend/                  # Static HTML/CSS/JS (served by EC2/Express)
├── backend/                   # Express.js server (EC2)
│   ├── server.js              # Entry point
│   ├── config/aws.js          # All AWS SDK clients
│   ├── routes/                # Express API routes
│   └── scripts/
│       ├── seedDynamoDB.js    # Creates + seeds product table
│       └── setupS3.js         # Creates S3 receipts bucket
├── lambda/
│   └── index.mjs              # Lambda function code (upload to AWS)
└── README.md
```

---

## Setup — AWS Academy Learner Lab

### Step 1: Update Credentials

1. In Vocareum / Canvas → **AWS Details → Show**
2. Copy `aws_access_key_id`, `aws_secret_access_key`, and `aws_session_token`.
   > **⚠️ CRITICAL:** The `aws_session_token` is extremely long. Make sure you copy the entire string, otherwise AWS will reject your credentials with an "Invalid Token" error.
3. Open `backend/.env` and paste the new values.

### Step 2: Create Cognito User Pool

1. AWS Console → **Cognito** → **Create user pool**
2. **Authentication providers** → Cognito user pool → sign-in: **Email**
3. Password policy → Cognito defaults (keep as is)
4. **MFA** → No MFA
5. **Email** → Send email with Cognito (no SES needed)
6. **App type** → Select **Single-page application (SPA)** (This ensures no Client Secret is generated. If a secret is generated, your app will fail to log in!).
7. Name the pool: `shopcloud-users`
8. After creation, copy the **User Pool ID** and paste in `.env` as `COGNITO_USER_POOL_ID`.
9. Go to the **App integration** tab, scroll down to App clients, and copy the **Client ID** into `.env` as `COGNITO_CLIENT_ID`.
10. Click the app client name → **Edit** → Enable **ALLOW_USER_PASSWORD_AUTH** flow → Save.

### Step 3: Seed DynamoDB and Create S3 Bucket

1. Open a terminal on your computer in the `backend` folder.
2. Run the following commands:
```bash
npm install          # first time only
npm run seed         # creates ecommerce-products table with 8 items
npm run setup-s3     # creates ecommerce-receipts bucket
```

### Step 4: Deploy the Lambda Function

1. AWS Console → **Lambda** → **Create function**
2. **Name**: `ecommerce-process-purchase`
3. **Runtime**: Node.js 20.x
4. **Permissions**: Change default execution role → Use an existing role → `LabRole`
5. Click **Create function**.
6. Paste the code from `lambda/index.mjs` into the AWS Lambda code editor and click **Deploy**.
7. Go to **Configuration** tab → **Environment variables** → Add:
   - Key: `DYNAMODB_PRODUCTS_TABLE`
   - Value: `ecommerce-products`
8. Save.

---

## Deploying to Amazon EC2

To host your server live on AWS, you must copy the project to an EC2 instance.

### Step 1: Fix `.pem` File Permissions (Windows Only)
If you are using Windows, you must restrict permissions on your SSH key or SSH will reject it with a "Permissions are too open" error. Open a Command Prompt in the folder containing your `.pem` key:
```cmd
icacls your-key.pem /inheritance:r
icacls your-key.pem /grant %username%:R
icacls your-key.pem /remove *S-1-5-11
icacls your-key.pem /remove *S-1-5-32-545
```

### Step 2: Transfer Files to EC2
1. Zip your project files (Do **not** include the `node_modules` folder, but **do** include your `backend/.env` file).
   - Alternatively, package it using `tar` in your terminal: 
     `tar -czf project.tar.gz --exclude="backend/node_modules" backend frontend lambda`
2. Copy the file to your EC2 instance using SCP (replace the IP with your EC2 public IP):
```bash
scp -i your-key.pem project.tar.gz ec2-user@YOUR.EC2.IP.ADDRESS:/home/ec2-user/
```

### Step 3: Connect and Start the Server
1. SSH into your EC2 instance:
```bash
ssh -i your-key.pem ec2-user@YOUR.EC2.IP.ADDRESS
```
2. Extract the files:
```bash
tar -xzf project.tar.gz
```
3. Install Node.js (Amazon Linux 2023):
```bash
sudo dnf install -y nodejs
```
4. Start the backend:
```bash
cd backend
npm install
npm start
```

### Step 4: Allow Port 3000
By default, the Express app runs on port `3000`. You must allow inbound traffic to this port:
1. Go to the **EC2 Dashboard** in the AWS Console.
2. Select your running instance → Click the **Security** tab → Click your **Security Group**.
3. Click **Edit inbound rules** → Add a rule.
4. **Type:** Custom TCP, **Port Range:** `3000`, **Source:** `Anywhere-IPv4` (`0.0.0.0/0`).
5. Save rules.

Open `http://YOUR.EC2.IP.ADDRESS:3000` in your browser!

---

## User Flow

```text
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
