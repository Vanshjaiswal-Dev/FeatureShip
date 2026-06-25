import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const orgId = req.user?.orgId;

    if (!name || !orgId) {
      res.status(400).json({ error: 'Project name and organization are required' });
      return;
    }

    // Automatically create default environments when creating a project
    const project = await prisma.project.create({
      data: {
        name,
        description,
        organizationId: orgId,
        environments: {
          create: [
            { name: 'Development' },
            { name: 'Production' }
          ]
        }
      },
      include: {
        environments: true
      }
    });

    res.status(201).json(project);
  } catch (error: any) {
    console.error('Create Project Error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;

    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      include: { environments: true }
    });

    res.status(200).json(projects);
  } catch (error: any) {
    console.error('Get Projects Error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.orgId;

    const project = await prisma.project.findFirst({
      where: { id, organizationId: orgId },
      include: { environments: true, featureFlags: true }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(200).json(project);
  } catch (error: any) {
    console.error('Get Project Error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
};
