import { Router } from 'express';
import { rubricController } from '../controllers/rubric.controller.js';

export const rubricRoutes = Router();

rubricRoutes.get('/', (req, res, next) => rubricController.getDefaultRubric(req, res, next));
