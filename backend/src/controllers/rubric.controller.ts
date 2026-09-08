import { Request, Response, NextFunction } from 'express';
import { rubricService } from '../services/rubric.service.js';

export class RubricController {
  async getDefaultRubric(_req: Request, res: Response, next: NextFunction) {
    try {
      const rubric = await rubricService.getDefaultRubric();
      res.json({ rubric });
    } catch (err) {
      next(err);
    }
  }
}

export const rubricController = new RubricController();
