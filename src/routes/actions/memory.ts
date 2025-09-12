import { Router } from 'express';
import { memorySaveHandler } from '../../actions/memory/save';

const router = Router();

// POST /actions/memory/save
router.post('/save', memorySaveHandler);

export default router;