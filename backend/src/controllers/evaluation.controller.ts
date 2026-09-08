import { Request, Response, NextFunction } from 'express';
import { evaluationService } from '../services/evaluation.service.js';
import { AppError } from '../middleware/errorHandler.js';

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

export class EvaluationController {
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.evaluationId || req.params.id || req.params.submissionId).trim();

      if (!id) {
        throw new AppError(400, 'Evaluation identifier is required');
      }

      try {
        const evaluation = await evaluationService.getEvaluationById(id);
        return res.json({ evaluation });
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 404) {
          // Fallback to checking by submissionId for backwards compatibility
          const evaluation = await evaluationService.getEvaluationBySubmissionId(id);
          return res.json({ evaluation });
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }

  async getBySubmissionId(req: Request, res: Response, next: NextFunction) {
    return this.getById(req, res, next);
  }

  async retry(req: Request, res: Response, next: NextFunction) {
    try {
      const evaluationId = getParam(req.params.evaluationId || req.params.id).trim();

      if (!evaluationId) {
        throw new AppError(400, 'Evaluation identifier is required');
      }

      // Retry transitions FAILED -> EVALUATING in-place
      const retryingEval = await evaluationService.retryEvaluation(evaluationId);

      // Re-evaluate using submission ID
      const evaluation = await evaluationService.evaluateSubmission(retryingEval.submissionId);
      res.status(200).json({ evaluation });
    } catch (err) {
      next(err);
    }
  }
}

export const evaluationController = new EvaluationController();
