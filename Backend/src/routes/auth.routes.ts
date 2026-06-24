import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

router.post('/register', register);
router.post('/login', login);

// Google OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const user: any = req.user;
    const token = jwt.sign({ id: user._id, orgId: user.organizationId }, JWT_SECRET, { expiresIn: '7d' });
    
    // Redirect back to frontend with the token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/success?token=${token}`);
  }
);

export default router;
