import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

const awsConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    // Required for AWS Academy Learner Lab (temporary credentials)
    ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
  },
};

// DynamoDB Client
const dynamoDBRaw = new DynamoDBClient(awsConfig);
export const dynamoDB = DynamoDBDocumentClient.from(dynamoDBRaw);

// S3 Client
export const s3 = new S3Client(awsConfig);

// Lambda Client
export const lambda = new LambdaClient(awsConfig);

// Cognito Client
export const cognito = new CognitoIdentityProviderClient(awsConfig);

export const TABLES = {
  PRODUCTS: process.env.DYNAMODB_PRODUCTS_TABLE || "ecommerce-products",
  USERS: process.env.DYNAMODB_USERS_TABLE || "ecommerce-users",
};

export const S3_BUCKET = process.env.S3_RECEIPTS_BUCKET || "ecommerce-receipts";

export const COGNITO = {
  USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  CLIENT_ID: process.env.COGNITO_CLIENT_ID,
};
