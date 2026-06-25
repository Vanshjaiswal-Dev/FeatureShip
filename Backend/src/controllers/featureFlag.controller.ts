import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const createFeatureFlag = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { name, description, type } = req.body;
    const orgId = req.user?.orgId;

    if (!name || !projectId || !orgId) {
      res.status(400).json({ error: 'Flag name and project ID are required' });
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
        description,
        type: type || 'BOOLEAN',
        projectId,
        // Important: Create an EnvironmentFlagConfig for EVERY environment in this project
        environments: {
          create: project.environments.map(env => ({
            environmentId: env.id,
            status: 'OFF'
          }))
        }
      },
      include: {
        environments: true
      }
    });

    res.status(201).json(flag);
  } catch (error: any) {
    console.error('Create Feature Flag Error:', error);
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
};

export const getFeatureFlagsByProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const orgId = req.user?.orgId;

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
      include: { environments: true }
    });

    res.status(200).json(flags);
  } catch (error: any) {
    console.error('Get Feature Flags Error:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
};

export const updateFeatureFlagConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, flagId, environmentId } = req.params;
    const { status, rolloutPercentage } = req.body;
    const orgId = req.user?.orgId;

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
        environmentId_featureFlagId: {
          environmentId,
          featureFlagId: flagId
        }
      },
      data: {
        status,
        rolloutPercentage
      }
    });

    res.status(200).json(config);
  } catch (error: any) {
    console.error('Update Feature Flag Config Error:', error);
    res.status(500).json({ error: 'Failed to update feature flag config' });
  }
};
