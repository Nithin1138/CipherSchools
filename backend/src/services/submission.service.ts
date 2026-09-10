import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { AttemptStatus, SubmissionType } from '../domain/types.js';

export class SubmissionService {
  /**
   * Submits a learner design solution for an attempt.
   * Enforces that submission is persisted BEFORE evaluation can take place.
   */
  async createSubmission(attemptId: string, content: string, type: string = SubmissionType.TEXT) {
    if (!content || content.trim().length === 0) {
      throw new AppError(400, 'Submission content cannot be empty.');
    }

    if (content.trim().length < 20) {
      throw new AppError(400, 'Submission is too brief. Please provide a meaningful design description.');
    }

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { submission: true },
    });

    if (!attempt) {
      throw new AppError(404, `Attempt not found with ID: ${attemptId}`);
    }

    if (attempt.submission) {
      throw new AppError(409, 'This attempt already has a submission. To try again, start a new attempt.');
    }

    // Persist submission and mark attempt completed in a transaction
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const submission = await tx.submission.create({
        data: {
          attemptId,
          content: content.trim(),
          type,
        },
      });

      await tx.attempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return submission;
    });
  }

  /**
   * Retrieves a submission by ID
   */
  async getSubmissionById(id: string) {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        attempt: {
          include: { problem: true },
        },
        evaluation: {
          include: {
            feedback: true,
          },
        },
      },
    });

    if (!submission) {
      throw new AppError(404, `Submission not found with ID: ${id}`);
    }

    return submission;
  }
}

export const submissionService = new SubmissionService();
