import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import redisClient from '../config/redis';

export const createFeatureFlag = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const { name, key, description, type } = req.body;
    const orgId = (req as AuthRequest).user?.orgId as string;

    if (!name || !key || !projectId || !orgId) {
      res.status(400).json({ error: 'Flag name, key, and project ID are required' });
      return;
    }

    // Verify project belongs to user's organization and fetch its environments
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      include: { environments: true }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    const flag = await prisma.featureFlag.create({
      data: {
        name,
        key,
        description,
        type: type || 'BOOLEAN',
        projectId,
        // Important: Create an EnvironmentFlagConfig for EVERY environment in this project
        configs: {
          create: project.environments.map(env => ({
            environmentId: env.id,
            isActive: false
          }))
        }
      },
      include: {
        configs: true
      }
    });

    // Invalidate Redis Cache for all environments in this project
    const cacheKeys = project.environments.map(env => `env_config:${env.clientKey}`);
    if (cacheKeys.length > 0) {
      await redisClient.del(cacheKeys);
    }

    // Publish SSE events for all environments
    project.environments.forEach(env => {
      redisClient.publish('flag-updates', JSON.stringify({
        clientKey: env.clientKey,
        type: 'FLAG_CREATED',
        flagKey: flag.key,
        config: {
          isActive: false,
          rolloutPercentage: 100,
          type: flag.type,
          defaultVariant: "false"
        }
      }));
    });

    res.status(201).json(flag);
  } catch (error: any) {
    console.error('Create Feature Flag Error:', error);
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
};

export const getFeatureFlagsByProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const orgId = (req as AuthRequest).user?.orgId as string;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    const flags = await prisma.featureFlag.findMany({
      where: { projectId },
      include: { configs: true }
    });

    res.status(200).json(flags);
  } catch (error: any) {
    console.error('Get Feature Flags Error:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
};

export const updateFeatureFlagConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const flagId = req.params.flagId as string;
    const environmentId = req.params.environmentId as string;
    const { isActive, rolloutPercentage } = req.body;
    const orgId = (req as AuthRequest).user?.orgId as string;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    const config = await prisma.environmentFlagConfig.update({
      where: {
        flagId_environmentId: {
          environmentId,
          flagId
        }
      },
      data: {
        isActive,
        rolloutPercentage
      },
      include: {
        environment: true,
        flag: true
      }
    });

    // Invalidate Redis Cache
    const cacheKey = `env_config:${config.environment.clientKey}`;
    await redisClient.del(cacheKey);

    // Publish SSE event
    await redisClient.publish('flag-updates', JSON.stringify({
      clientKey: config.environment.clientKey,
      type: 'FLAG_UPDATED',
      flagKey: config.flag.key,
      config: {
        isActive: config.isActive,
        rolloutPercentage: config.rolloutPercentage,
        type: config.flag.type,
        defaultVariant: config.defaultVariant
      }
    }));

    res.status(200).json(config);
  } catch (error: any) {
    console.error('Update Feature Flag Config Error:', error);
    res.status(500).json({ error: 'Failed to update feature flag config' });
  }
};
