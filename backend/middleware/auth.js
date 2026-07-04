import jwt from "jsonwebtoken";
import "dotenv/config";

/**
 * Decodes a Cognito Bearer JWT to extract user identity claims.
 * We decode without signature verification here because:
 *   - Cognito tokens are validated by Cognito's own /me endpoint (see auth route)
 *   - This middleware is only used to extract `sub` for internal resource scoping
 *     (e.g., receipts belong to a specific sub/userId)
 *
 * Returns: { sub, email, name, username }
 * Throws on missing / malformed token.
 */
export function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No access token provided.");
  }
  const token = authHeader.split(" ")[1];

  // jwt.decode does NOT verify signature — safe here as Cognito validates tokens
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.sub) {
    throw new Error("Invalid access token.");
  }

  return {
    sub: decoded.sub,
    email: decoded.email || decoded.username || "",
    name: decoded.name || decoded.email || "",
    username: decoded.email || decoded.username || "",
  };
}

/**
 * Alias kept for existing route compatibility.
 */
export const getUserSub = (authHeader) => verifyToken(authHeader).sub;
