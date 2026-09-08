export interface Problem {
  id: string;
  slug: string;
  title: string;
  description: string;
  problemStatement: string;
  requirements: string[];
  constraints: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  createdAt: string;
}

export interface RubricCriterion {
  id: string;
  rubricId: string;
  name: string;
  description: string;
  maxScore: number;
  orderIndex: number;
}

export interface Rubric {
  id: string;
  name: string;
  description: string;
  criteria: RubricCriterion[];
}

export interface CriterionFeedback {
  id: string;
  criterionId?: string;
  criterionName: string;
  score: number;
  maxScore: number;
  evidence: string;
  concern?: string | null;
  suggestion?: string | null;
  confidence?: number | null;
}

export interface Evaluation {
  id: string;
  submissionId: string;
  evaluatorType: string;
  status: 'PENDING' | 'EVALUATING' | 'COMPLETED' | 'FAILED';
  totalScore: number | null;
  maxScore: number;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  feedback: CriterionFeedback[];
}

export interface Submission {
  id: string;
  attemptId: string;
  type: string;
  content: string;
  submittedAt: string;
  evaluation?: Evaluation | null;
}

export interface Attempt {
  id: string;
  problemId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  completedAt?: string | null;
  problem?: Problem;
  submission?: Submission | null;
}

export interface AttemptHistoryItem {
  id: string;
  problemId: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  submission?: {
    id: string;
    type: string;
    submittedAt: string;
    evaluation?: {
      id: string;
      status: string;
      totalScore: number | null;
      maxScore: number;
      completedAt?: string | null;
    } | null;
  } | null;
}
