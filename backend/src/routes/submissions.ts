import { Router } from 'express';
import { submissionController } from '../controllers/submission.controller.js';

export const submissionRoutes = Router();

// POST /api/submissions
submissionRoutes.post('/', (req, res, next) => submissionController.create(req, res, next));

// GET /api/submissions/:submissionId
submissionRoutes.get('/:submissionId', (req, res, next) => submissionController.getById(req, res, next));

// POST /api/submissions/:submissionId/evaluation
submissionRoutes.post('/:submissionId/evaluation', (req, res, next) => submissionController.evaluate(req, res, next));

// POST /api/submissions/:submissionId/evaluate (alias)
submissionRoutes.post('/:submissionId/evaluate', (req, res, next) => submissionController.evaluate(req, res, next));
