import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: number;
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).json({ error: "missing token" });
  }

  try {
    // jwt.verify(token, process.env.JWT_SECRET as string) verifies the JWT token using the secret key from the environment variable.
    // If the token is valid, it decodes the token payload, which should include the userId.
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number;
    };
    // req.userId = decoded.userId; attaches the userId from the decoded token to the request object,
    // which makes the authenticated user's ID available to downstream handlers.
    req.userId = decoded.userId;
    // next(); calls the next middleware in the stack, allowing the authenticated request to proceed.
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "token expired" });
    }
    res.status(401).json({ error: "invalid token" });
  }
}
