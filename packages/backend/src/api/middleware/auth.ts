import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, users } from "../../db";
import { eq } from "drizzle-orm";

interface User {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  reset_token: string | null;
  reset_token_expiry: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AuthError("Authorization header with Bearer token required");
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    const user = userResults[0];
    if (!user) {
      throw new AuthError("User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ error: error.message });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
    } else {
      res.status(500).json({ error: "Authentication failed" });
    }
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    const user = userResults[0];
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Silently continue without user for optional auth
  }

  next();
};
