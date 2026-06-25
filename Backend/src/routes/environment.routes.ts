import { Router } from 'express';
import { createEnvironment, getEnvironmentsByProject } from '../controllers/environment.controller';
import { protect } from '../middlewares/auth.middleware';

// mergeParams: true is needed so we can access :projectId from the parent router
const router = Router({ mergeParams: true });

router.use(protect);

router.route('/')
  .post(createEnvironment)
  .get(getEnvironmentsByProject);

export default router;
