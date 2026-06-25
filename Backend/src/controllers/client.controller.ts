import { Request, Response } from 'express';
import prisma from '../config/prisma';
import redisClient from '../config/redis';
import { sseService } from '../services/sse.service';

export const getConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Client key missing or invalid format' });
      return;
    }

    const clientKey = authHeader.split(' ')[1];

    // 1. Check Redis Cache
    const cacheKey = `env_config:${clientKey}`;
    const cachedConfig = await redisClient.get(cacheKey);

    if (cachedConfig) {
      // Hit: Return from Cache
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json(JSON.parse(cachedConfig));
      return;
    }

    // 2. Cache Miss: Fetch from DB
    const environment = await prisma.environment.findUnique({
      where: { clientKey },
      include: {
        flagConfigs: {
          include: {
            flag: true
          }
        }
      }
    });

    if (!environment) {
      res.status(401).json({ error: 'Invalid client key' });
      return;
    }

    // 3. Format Response
    const configPayload: Record<string, any> = {};
    for (const config of environment.flagConfigs) {
      configPayload[config.flag.key] = {
        isActive: config.isActive,
        rolloutPercentage: config.rolloutPercentage,
        type: config.flag.type,
        defaultVariant: config.defaultVariant
      };
    }

    // 4. Save to Redis (Cache for 5 minutes as a safety net)
    await redisClient.set(cacheKey, JSON.stringify(configPayload), {
      EX: 300
    });

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(configPayload);
  } catch (error: any) {
    console.error('Edge Config Error:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
};

export const streamConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let clientKey: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      clientKey = authHeader.split(' ')[1];
    } else if (req.query.clientKey && typeof req.query.clientKey === 'string') {
      clientKey = req.query.clientKey;
    }

    if (!clientKey) {
      res.status(401).json({ error: 'Client key missing or invalid format' });
      return;
    }

    // Verify clientKey exists in DB
    const environment = await prisma.environment.findUnique({ where: { clientKey } });
    if (!environment) {
      res.status(401).json({ error: 'Invalid client key' });
      return;
    }

    // Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Register client
    sseService.addClient(clientKey!, res);

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE stream established' })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      sseService.removeClient(clientKey!, res);
    });
  } catch (error: any) {
    console.error('SSE Stream Error:', error);
    res.status(500).end();
  }
};
