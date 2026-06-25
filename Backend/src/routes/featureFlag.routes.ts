import { Router } from 'express';
import { createFeatureFlag, getFeatureFlagsByProject, updateFeatureFlagConfig } from '../controllers/featureFlag.controller';
import { protect } from '../middlewares/auth.middleware';

// mergeParams: true is needed so we can access :projectId from the parent router
const router = Router({ mergeParams: true });

router.use(protect);

router.route('/')
  .post(createFeatureFlag)
  .get(getFeatureFlagsByProject);

router.route('/:flagId/environments/:environmentId')
  .put(updateFeatureFlagConfig);

export default router;
