import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, users } from '../../db';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

    if (!user[0]) {
      throw new Error();
    }

    req.user = user[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      
      if (user[0]) {
        req.user = user[0];
      }
    }
  } catch (error) {
    // Continue without user
  }
  
  next();
};
