import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { attemptService } from '../services/attempt.service.js';
import { AppError } from '../middleware/errorHandler.js';

const CreateAttemptSchema = z.object({
  problemId: z.string().min(1, 'problemId is required'),
});

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

export class AttemptController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const problemId = getParam(req.params.problemId) || req.body.problemId;
      const parsed = CreateAttemptSchema.safeParse({ problemId });
      if (!parsed.success) {
        throw new AppError(400, parsed.error.errors[0].message);
      }

      const attempt = await attemptService.createAttempt(parsed.data.problemId);
      res.status(201).json({ attempt });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.attemptId || req.params.id).trim();

      if (!id) {
        throw new AppError(400, 'Attempt identifier is required');
      }

      const attempt = await attemptService.getAttemptById(id);
      res.json({ attempt });
    } catch (err) {
      next(err);
    }
  }
}

export const attemptController = new AttemptController();
