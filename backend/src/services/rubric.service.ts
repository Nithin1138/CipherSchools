import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export class RubricService {
  /**
   * Retrieves the default LLD evaluation rubric with ordered criteria
   */
  async getDefaultRubric() {
    const rubric = await prisma.rubric.findFirst({
      where: { isDefault: true },
      include: {
        criteria: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!rubric) {
      throw new AppError(500, 'Default evaluation rubric not configured. Please run database seed.');
    }

    return rubric;
  }
}

export const rubricService = new RubricService();
