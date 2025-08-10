import { Router, type Router as ExpressRouter } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db, users } from '../../db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router: ExpressRouter = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser[0]) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create user
    const [user] = await db.insert(users).values({
      email: validatedData.email,
      name: validatedData.name || validatedData.email.split('@')[0],
      password_hash: hashedPassword
    }).returning();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      return res.status(500).json({ error: error.message });
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    // Find user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(
      validatedData.password,
      user.password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      return res.status(500).json({ error: error.message });
    }
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at
    });
  } catch (error: any) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    // Generate reset token
    const resetToken = nanoid(32);
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token (you'll need to add these columns to your users table)
    await db.update(users)
      .set({
        reset_token: resetToken,
        reset_token_expiry: resetExpiry
      })
      .where(eq(users.id, user.id));

    // TODO: Send email with reset link
    // In production, use a service like SendGrid, AWS SES, etc.
    console.log(`Password reset link: ${process.env.FRONTEND_URL}/reset-password/${resetToken}`);

    return res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    // Find user with valid reset token
    const [user] = await db.select()
      .from(users)
      .where(eq(users.reset_token, token))
      .limit(1);

    if (!user || !user.reset_token_expiry || user.reset_token_expiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await db.update(users)
      .set({
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expiry: null
      })
      .where(eq(users.id, user.id));

    return res.json({ message: 'Password reset successful' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;