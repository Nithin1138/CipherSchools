import { Router } from 'express';
import { attemptController } from '../controllers/attempt.controller.js';
import { submissionController } from '../controllers/submission.controller.js';

export const attemptRoutes = Router();

// POST /api/attempts
attemptRoutes.post('/', (req, res, next) => attemptController.create(req, res, next));

// GET /api/attempts/:attemptId
attemptRoutes.get('/:attemptId', (req, res, next) => attemptController.getById(req, res, next));

// POST /api/attempts/:attemptId/submission
attemptRoutes.post('/:attemptId/submission', (req, res, next) => submissionController.create(req, res, next));
