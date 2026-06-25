import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const createEnvironment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { name } = req.body;
    const orgId = req.user?.orgId;

    if (!name || !projectId || !orgId) {
      res.status(400).json({ error: 'Environment name and project ID are required' });
      return;
    }

    // Verify project belongs to the user's organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    const environment = await prisma.environment.create({
      data: {
        name,
        projectId
      }
    });

    // When creating a new environment, we must create EnvironmentFlagConfig 
    // entries for every existing feature flag in this project.
    const flags = await prisma.featureFlag.findMany({
      where: { projectId }
    });

    if (flags.length > 0) {
      await prisma.environmentFlagConfig.createMany({
        data: flags.map(flag => ({
          environmentId: environment.id,
          featureFlagId: flag.id,
          status: 'OFF'
        }))
      });
    }

    res.status(201).json(environment);
  } catch (error: any) {
    console.error('Create Environment Error:', error);
    res.status(500).json({ error: 'Failed to create environment' });
  }
};

export const getEnvironmentsByProject = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const environments = await prisma.environment.findMany({
      where: { projectId }
    });

    res.status(200).json(environments);
  } catch (error: any) {
    console.error('Get Environments Error:', error);
    res.status(500).json({ error: 'Failed to get environments' });
  }
};
