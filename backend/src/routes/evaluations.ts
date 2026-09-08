import { Router } from 'express';
import { evaluationController } from '../controllers/evaluation.controller.js';

export const evaluationRoutes = Router();

// GET /api/evaluations/:evaluationId
evaluationRoutes.get('/:evaluationId', (req, res, next) => evaluationController.getById(req, res, next));

// POST /api/evaluations/:evaluationId/retry
evaluationRoutes.post('/:evaluationId/retry', (req, res, next) => evaluationController.retry(req, res, next));
