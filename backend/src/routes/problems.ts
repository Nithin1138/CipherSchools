import { Router } from 'express';
import { problemController } from '../controllers/problem.controller.js';
import { attemptController } from '../controllers/attempt.controller.js';

export const problemRoutes = Router();

// GET /api/problems
problemRoutes.get('/', (req, res, next) => problemController.getAll(req, res, next));

// GET /api/problems/slug/:slug
problemRoutes.get('/slug/:slug', (req, res, next) => problemController.getBySlug(req, res, next));

// GET /api/problems/:id
problemRoutes.get('/:id', (req, res, next) => problemController.getById(req, res, next));

// GET /api/problems/:problemId/attempts
problemRoutes.get('/:problemId/attempts', (req, res, next) => problemController.getAttempts(req, res, next));

// POST /api/problems/:problemId/attempts
problemRoutes.post('/:problemId/attempts', (req, res, next) => attemptController.create(req, res, next));
