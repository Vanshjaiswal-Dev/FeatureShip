import { Router } from 'express';
import { getConfig, streamConfig } from '../controllers/client.controller';

const router = Router();

// GET /api/v1/client/config
router.get('/config', getConfig);

// GET /api/v1/client/stream
router.get('/stream', streamConfig);

export default router;
