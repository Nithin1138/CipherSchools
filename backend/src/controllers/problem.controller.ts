import { Request, Response, NextFunction } from 'express';
import { problemService } from '../services/problem.service.js';
import { attemptService } from '../services/attempt.service.js';
import { AppError } from '../middleware/errorHandler.js';

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

export class ProblemController {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const problems = await problemService.getAllProblems();
      res.json({ problems });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.id);
      const problem = await problemService.getProblemByIdOrSlug(id);
      res.json({ problem });
    } catch (err) {
      next(err);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = getParam(req.params.slug).trim();
      if (!slug) {
        throw new AppError(400, 'Slug parameter is required');
      }
      const problem = await problemService.getProblemBySlug(slug);
      res.json({ problem });
    } catch (err) {
      next(err);
    }
  }

  async getAttempts(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.problemId || req.params.id).trim();
      if (!id) {
        throw new AppError(400, 'Problem identifier is required');
      }
      const attempts = await attemptService.getAttemptsByProblem(id);
      res.json({ attempts });
    } catch (err) {
      next(err);
    }
  }
}

export const problemController = new ProblemController();
