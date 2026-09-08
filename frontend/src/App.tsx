import { useState, useEffect, useCallback } from 'react';
import './App.css';
import type { Problem, Rubric, Attempt, Submission, Evaluation } from './types/index.js';
import { api } from './api/client.js';
import { ProblemList } from './components/ProblemList.js';
import { ProblemDetail } from './components/ProblemDetail.js';
import { DesignEditor } from './components/DesignEditor.js';
import { EvaluationView } from './components/EvaluationView.js';

type ViewMode = 'LIST' | 'PROBLEM_DETAIL' | 'EDITOR' | 'EVALUATING' | 'EVALUATION';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<Attempt | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Initialize: Check backend health and fetch problems + default rubric
  useEffect(() => {
    async function init() {
      try {
        const health = await api.getHealth();
        setBackendOnline(health.status === 'ok');

        const [probList, rubricData] = await Promise.all([
          api.getProblems(),
          api.getDefaultRubric(),
        ]);
        setProblems(probList);
        setRubric(rubricData);
        setLoading(false);
      } catch (err: unknown) {
        console.error('Initialization error:', err);
        setBackendOnline(false);
        setGlobalError((err as Error).message);
        setLoading(false);
      }
    }
    init();
  }, []);

  // Navigation handlers
  const handleSelectProblem = (problem: Problem) => {
    setSelectedProblem(problem);
    setViewMode('PROBLEM_DETAIL');
  };

  const handleStartAttempt = async () => {
    if (!selectedProblem) return;
    setLoading(true);
    setGlobalError(null);
    try {
      const attempt = await api.createAttempt(selectedProblem.id);
      setCurrentAttempt(attempt);
      setViewMode('EDITOR');
    } catch (err: unknown) {
      setGlobalError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttempt = async (attemptId: string) => {
    setLoading(true);
    setGlobalError(null);
    try {
      const attempt = await api.getAttempt(attemptId);
      setCurrentAttempt(attempt);

      if (attempt.submission) {
        setCurrentSubmission(attempt.submission);
        if (attempt.submission.evaluation) {
          setCurrentEvaluation(attempt.submission.evaluation);
          setViewMode('EVALUATION');
          setLoading(false);
          return;
        }
      }
      // If attempt had no submission yet, resume in editor
      setViewMode('EDITOR');
    } catch (err: unknown) {
      setGlobalError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDesign = async (content: string) => {
    if (!currentAttempt) return;
    setSubmitting(true);
    setGlobalError(null);

    try {
      // Step 1: Save submission first (Save-before-evaluate guarantee)
      const submission = await api.createSubmission(currentAttempt.id, content);
      setCurrentSubmission(submission);
      setViewMode('EVALUATING');

      // Step 2: Trigger evaluation
      const evaluation = await api.triggerEvaluation(submission.id);
      setCurrentEvaluation(evaluation);
      setViewMode('EVALUATION');
    } catch (err: unknown) {
      setGlobalError((err as Error).message);
      // If submission succeeded but evaluation failed, load evaluation state to show retry
      if (currentSubmission) {
        try {
          const failedEval = await api.getEvaluation(currentSubmission.id);
          setCurrentEvaluation(failedEval);
          setViewMode('EVALUATION');
        } catch {
          // keep editor view if evaluation couldn't be loaded
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryEvaluation = async () => {
    if (!currentSubmission) return;
    setRetrying(true);
    setGlobalError(null);
    try {
      const evaluation = await api.triggerEvaluation(currentSubmission.id);
      setCurrentEvaluation(evaluation);
    } catch (err: unknown) {
      setGlobalError((err as Error).message);
    } finally {
      setRetrying(false);
    }
  };

  const handleTryAgain = useCallback(() => {
    // "Try Again" creates a completely new Attempt for the same problem
    if (selectedProblem) {
      handleStartAttempt();
    }
  }, [selectedProblem]);

  return (
    <div className="platform-layout">
      {/* Top Application Header */}
      <header className="platform-header">
        <div className="header-brand" onClick={() => setViewMode('LIST')} role="button" tabIndex={0}>
          <div className="brand-logo">LLD</div>
          <div>
            <h1 className="brand-title">Practice Platform</h1>
            <span className="brand-subtitle">Design &bull; Evaluate &bull; Improve</span>
          </div>
        </div>

        <nav className="header-nav">
          <button
            type="button"
            className={`nav-link ${viewMode === 'LIST' ? 'active' : ''}`}
            onClick={() => setViewMode('LIST')}
          >
            Problems
          </button>
          {selectedProblem && (
            <button
              type="button"
              className={`nav-link ${viewMode === 'PROBLEM_DETAIL' ? 'active' : ''}`}
              onClick={() => setViewMode('PROBLEM_DETAIL')}
            >
              {selectedProblem.title}
            </button>
          )}
          <div className="backend-indicator">
            <span className={`dot ${backendOnline ? 'online' : 'offline'}`} />
            <span>{backendOnline ? 'Backend API Ready' : 'Backend Offline'}</span>
          </div>
        </nav>
      </header>

      {/* Global Error Banner */}
      {globalError && (
        <div className="global-error-bar">
          <span>{globalError}</span>
          <button type="button" onClick={() => setGlobalError(null)}>
            &times;
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="platform-main">
        {loading && viewMode !== 'EVALUATING' && (
          <div className="central-loading">
            <div className="spinner" />
            <p>Loading LLD platform resources...</p>
          </div>
        )}

        {viewMode === 'LIST' && (
          <ProblemList
            problems={problems}
            onSelectProblem={handleSelectProblem}
            loading={loading}
          />
        )}

        {viewMode === 'PROBLEM_DETAIL' && selectedProblem && (
          <ProblemDetail
            problem={selectedProblem}
            rubric={rubric}
            onStartAttempt={handleStartAttempt}
            onViewAttempt={handleViewAttempt}
            onBack={() => setViewMode('LIST')}
          />
        )}

        {viewMode === 'EDITOR' && selectedProblem && currentAttempt && (
          <DesignEditor
            problem={selectedProblem}
            attempt={currentAttempt}
            onSubmit={handleSubmitDesign}
            submitting={submitting}
            onCancel={() => setViewMode('PROBLEM_DETAIL')}
          />
        )}

        {viewMode === 'EVALUATING' && (
          <div className="evaluating-state-container">
            <div className="spinner big" />
            <h2>Evaluating Your Low-Level Design...</h2>
            <p className="lead">
              Our Rubric Evaluator is assessing class responsibilities, coupling &amp; cohesion, abstraction choices, and edge cases against the standard 100-point rubric.
            </p>
            <div className="eval-steps-badge">
              <span>Saved Design</span> &rarr; <span className="highlight">Running Rubric Evaluation</span> &rarr; <span>Generating Evidence Feedback</span>
            </div>
          </div>
        )}

        {viewMode === 'EVALUATION' && selectedProblem && currentSubmission && currentEvaluation && (
          <EvaluationView
            problem={selectedProblem}
            submission={currentSubmission}
            evaluation={currentEvaluation}
            onTryAgain={handleTryAgain}
            onRetryEvaluation={handleRetryEvaluation}
            retrying={retrying}
            onBackToProblems={() => setViewMode('LIST')}
          />
        )}
      </main>

      {/* Application Footer */}
      <footer className="platform-footer">
        <p>
          CipherSchools Full Stack LLD Practice Platform &bull; Built with React, TypeScript, Express, PostgreSQL &amp; Prisma
        </p>
      </footer>
    </div>
  );
}
