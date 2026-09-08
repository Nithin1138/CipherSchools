import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export class ProblemService {
  /**
   * Retrieves all available LLD problems for problem selection
   */
  async listProblems() {
    return prisma.problem.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Alias for listProblems
   */
  async getAllProblems() {
    return this.listProblems();
  }

  /**
   * Retrieves a problem by its unique ID
   */
  async getProblemById(id: string) {
    const problem = await prisma.problem.findUnique({
      where: { id },
    });

    if (!problem) {
      throw new AppError(404, `Problem not found with ID: ${id}`);
    }

    return problem;
  }

  /**
   * Retrieves a problem by its slug
   */
  async getProblemBySlug(slug: string) {
    const problem = await prisma.problem.findUnique({
      where: { slug },
    });

    if (!problem) {
      throw new AppError(404, `Problem not found with slug: ${slug}`);
    }

    return problem;
  }

  /**
   * Retrieves full problem details by ID or slug
   */
  async getProblemByIdOrSlug(identifier: string) {
    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
    });

    if (!problem) {
      throw new AppError(404, `Problem not found with identifier: ${identifier}`);
    }

    return problem;
  }
}

export const problemService = new ProblemService();
