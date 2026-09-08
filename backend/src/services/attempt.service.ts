import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AttemptStatus } from '../domain/types.js';

export class AttemptService {
  /**
   * Starts a new practice attempt for a problem.
   * Preserves historical attempts for the problem.
   */
  async createAttempt(problemId: string) {
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      throw new AppError(404, `Problem not found with ID: ${problemId}`);
    }

    return prisma.attempt.create({
      data: {
        problemId: problem.id,
        status: AttemptStatus.IN_PROGRESS,
      },
      include: {
        problem: true,
      },
    });
  }

  /**
   * Fetches an attempt with full submission, evaluation, and feedback details
   */
  async getAttemptById(id: string) {
    const attempt = await prisma.attempt.findUnique({
      where: { id },
      include: {
        problem: true,
        submission: {
          include: {
            evaluation: {
              include: {
                feedback: {
                  orderBy: { score: 'asc' }, // highlights critical feedback first
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new AppError(404, `Attempt not found with ID: ${id}`);
    }

    return attempt;
  }

  /**
   * Retrieves all historical attempts for a problem to track learner progress over time
   */
  async getAttemptsByProblem(problemId: string) {
    return this.getAttemptsForProblem(problemId);
  }

  /**
   * Retrieves all historical attempts for a problem to track learner progress over time
   */
  async getAttemptsForProblem(problemId: string) {
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      throw new AppError(404, `Problem not found with ID: ${problemId}`);
    }

    return prisma.attempt.findMany({
      where: { problemId },
      orderBy: { startedAt: 'desc' },
      include: {
        submission: {
          select: {
            id: true,
            type: true,
            submittedAt: true,
            evaluation: {
              select: {
                id: true,
                status: true,
                totalScore: true,
                maxScore: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });
  }
}

export const attemptService = new AttemptService();
