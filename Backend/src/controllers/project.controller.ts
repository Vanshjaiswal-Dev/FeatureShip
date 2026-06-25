import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const orgId = (req as AuthRequest).user?.orgId as string;

    if (!name || !orgId) {
      res.status(400).json({ error: 'Project name and organization are required' });
      return;
    }

    // Automatically create default environments when creating a project
    const project = await prisma.project.create({
      data: {
        name,
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

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = (req as AuthRequest).user?.orgId as string;

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

export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const orgId = (req as AuthRequest).user?.orgId as string;

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
