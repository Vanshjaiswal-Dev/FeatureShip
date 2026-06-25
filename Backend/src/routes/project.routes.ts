import { Router } from 'express';
import { createProject, getProjects, getProjectById } from '../controllers/project.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Protect all project routes
router.use(protect);

router.route('/')
  .post(createProject)
  .get(getProjects);

router.route('/:id')
  .get(getProjectById);

export default router;
