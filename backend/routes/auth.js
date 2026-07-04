import express from "express";
import {
  SignUpCommand,
  AdminConfirmSignUpCommand,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognito, COGNITO } from "../config/aws.js";
import "dotenv/config";

const router = express.Router();

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password, and name are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    // Step 1: Sign up user in Cognito
    await cognito.send(new SignUpCommand({
      ClientId: COGNITO.CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name",  Value: name  },
      ],
    }));

    // Step 2: Auto-confirm (skip email OTP — cleaner for demo)
    await cognito.send(new AdminConfirmSignUpCommand({
      UserPoolId: COGNITO.USER_POOL_ID,
      Username: email,
    }));

    return res.status(201).json({
      message: "Account created successfully! You can now log in.",
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error.name === "UsernameExistsException") {
      return res.status(400).json({ error: "An account with this email already exists." });
    }
    if (error.name === "InvalidPasswordException") {
      return res.status(400).json({ error: "Password does not meet requirements." });
    }
    return res.status(500).json({ error: error.message || "Registration failed." });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO.CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }));

    const { AccessToken, IdToken, RefreshToken, ExpiresIn } = result.AuthenticationResult;

    return res.json({
      message: "Login successful!",
      accessToken: AccessToken,
      idToken: IdToken,
      refreshToken: RefreshToken,
      expiresIn: ExpiresIn,
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error.name === "NotAuthorizedException" || error.name === "UserNotFoundException") {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    return res.status(500).json({ error: error.message || "Login failed." });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No access token provided." });
  }

  try {
    const token = authHeader.split(" ")[1];
    const result = await cognito.send(new GetUserCommand({ AccessToken: token }));

    const attrs = Object.fromEntries(
      result.UserAttributes.map((a) => [a.Name, a.Value])
    );

    return res.json({
      username: result.Username,
      email: attrs.email,
      name: attrs.name || attrs.email,
      sub: attrs.sub,
    });
  } catch (error) {
    console.error("GetUser error:", error);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      await cognito.send(new GlobalSignOutCommand({ AccessToken: token }));
    } catch (err) {
      console.error("Logout error:", err.message);
    }
  }
  return res.json({ message: "Logged out successfully." });
});

// ─── POST /api/auth/confirm (kept for compatibility) ─────────────────────────
router.post("/confirm", async (_req, res) => {
  return res.json({ message: "Account confirmed. You can now log in." });
});

export default router;
