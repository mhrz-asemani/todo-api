import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { pool } from "./db";
import { AppError } from "./error-schema";
import { asyncHandler } from "./asyncHandler";
import { validate } from "./validate";
import { signupSchema, loginSchema } from "./schemas";
import { authLimiter } from "./ratelimit";

const router = Router();

export function GenerateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

// ---------------------------------------------------------------------------------- Signup route
router.post(
  "/signup",
  authLimiter,
  validate(signupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError(
        "Email and password are required",
        400,
        "INVALID_ARGUMENT",
      );
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      throw new AppError("User already exists", 409, "ALREADY_EXISTS");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash],
    );
    // Return the created user
    res.status(201).json(result.rows[0]);
  }),
);

// ---------------------------------------------------------------------------------- Login route
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError(
        "Email and password are required",
        400,
        "INVALID_ARGUMENT",
      );
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user) {
      throw new AppError("Invalid credentials", 401, "UNAUTHENTICATED");
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AppError("Invalid credentials", 401, "UNAUTHENTICATED");
    }

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" },
    );

    const refreshToken = GenerateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Inserts refresh token into the database
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, refreshToken, expiresAt],
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: true, // prevents XSS attacks
      // secure: true,    // HTTPS only
      secure: process.env.NODE_ENV === "production", // in production, use secure: true (in dev it is false, beacause localhost is HTTP, not HTTPS)
      sameSite: "strict", // prevents CSRF (Cross-Site Request Forgery) attacks
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      // secure: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({ message: "logged in" }); // no tokens in the body anymore!
  }),
);

// ---------------------------------------------------------------------------------- Refresh Token route
// Refresh Token route to generate a new access token (compares refreshToken with the one in the database for validity and expiration)
router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new AppError("Refresh token is required", 400, "INVALID_ARGUMENT");
    }

    // check database if the refresh token is valid
    const result = await pool.query(
      "SELECT * FROM refresh_tokens WHERE token = $1",
      [refreshToken],
    );
    const stored = result.rows[0];

    if (!stored) {
      throw new AppError("Invalid refresh token", 401, "UNAUTHENTICATED");
    }

    // check database if the refresh token is expired
    if (new Date(stored.expires_at) < new Date()) {
      await pool.query("DELETE FROM refresh_tokens WHERE id = $1", [stored.id]);
      throw new AppError("Refresh token expired", 401, "EXPIRED_TOKEN");
    }

    // if the refresh token is not expired yet, generate a new access token
    const newAccessToken = jwt.sign(
      { userId: stored.user_id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      // secure: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.status(200).json({ message: "access token refreshed" });
  }),
);

// ---------------------------------------------------------------------------------- Logout route
router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [
      refreshToken,
    ]);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(204).send();
  }),
);

export default router;
