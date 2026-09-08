import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { submissionService } from '../services/submission.service.js';
import { evaluationService } from '../services/evaluation.service.js';
import { AppError } from '../middleware/errorHandler.js';

const SubmissionInputSchema = z.object({
  attemptId: z.string().min(1, 'attemptId is required'),
  content: z.string().min(1, 'Submission content cannot be empty').min(20, 'Submission must be at least 20 characters long'),
  type: z.enum(['TEXT', 'DIAGRAM', 'CODE']).default('TEXT'),
});

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

export class SubmissionController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const attemptId = getParam(req.params.attemptId) || req.body.attemptId;
      const parsed = SubmissionInputSchema.safeParse({
        attemptId,
        content: req.body.content,
        type: req.body.type || 'TEXT',
      });

      if (!parsed.success) {
        throw new AppError(400, parsed.error.errors[0].message);
      }

      const submission = await submissionService.createSubmission(
        parsed.data.attemptId,
        parsed.data.content,
        parsed.data.type
      );

      res.status(201).json({ submission });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.submissionId || req.params.id).trim();

      if (!id) {
        throw new AppError(400, 'Submission identifier is required');
      }

      const submission = await submissionService.getSubmissionById(id);
      res.json({ submission });
    } catch (err) {
      next(err);
    }
  }

  async evaluate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.submissionId || req.params.id).trim();

      if (!id) {
        throw new AppError(400, 'Submission identifier is required');
      }

      const evaluation = await evaluationService.evaluateSubmission(id);
      res.status(201).json({ evaluation });
    } catch (err) {
      next(err);
    }
  }
}

export const submissionController = new SubmissionController();
