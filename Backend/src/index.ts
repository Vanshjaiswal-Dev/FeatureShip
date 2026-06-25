import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';

import { connectRedis } from './config/redis';
import './config/passport';

import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import environmentRoutes from './routes/environment.routes';
import featureFlagRoutes from './routes/featureFlag.routes';
import clientRoutes from './routes/client.routes';
import prisma from './config/prisma';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(passport.initialize());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
// Nested routes under projects
app.use('/api/v1/projects/:projectId/environments', environmentRoutes);
app.use('/api/v1/projects/:projectId/flags', featureFlagRoutes);
app.use('/api/v1/client', clientRoutes);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'FeatureShip Backend is running.' });
});

// Start Server
const startServer = async () => {
  await connectRedis();

  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL Connected via Prisma');
  } catch (error) {
    console.error('❌ PostgreSQL Connection Error:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();
