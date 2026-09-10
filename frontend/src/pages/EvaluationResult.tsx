import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { submissionsApi, evaluationsApi, attemptsApi } from '../api/index.js';
import type { Submission, Evaluation } from '../types/index.js';
import { ScoreDisplay } from '../components/ScoreDisplay.js';
import { FeedbackCard } from '../components/FeedbackCard.js';
import { LoadingState } from '../components/LoadingState.js';
import { ErrorState } from '../components/ErrorState.js';

export const EvaluationResult: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [startingNewAttempt, setStartingNewAttempt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'FEEDBACK' | 'SUBMISSION'>('FEEDBACK');

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((evalId: string) => {
    clearPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const updated = await evaluationsApi.getEvaluation(evalId);
        setEvaluation(updated);

        // Stop polling when COMPLETED or FAILED
        if (updated.status === 'COMPLETED' || updated.status === 'FAILED') {
          clearPolling();
        }
      } catch {
        // Continue polling on temporary hiccup
      }
    }, 2000);
  }, [clearPolling]);

  const loadData = useCallback(async () => {
    if (!submissionId) return;
    try {
      const sub = await submissionsApi.getSubmission(submissionId);
      setSubmission(sub);

      if (sub.evaluation) {
        setEvaluation(sub.evaluation);

        // If still in EVALUATING or PENDING, schedule polling
        if (sub.evaluation.status === 'EVALUATING' || sub.evaluation.status === 'PENDING') {
          startPolling(sub.evaluation.id);
        } else {
          clearPolling();
        }
      } else {
        // If no evaluation yet, trigger it
        try {
          const evalData = await evaluationsApi.triggerEvaluation(submissionId);
          setEvaluation(evalData);
          if (evalData.status === 'EVALUATING' || evalData.status === 'PENDING') {
            startPolling(evalData.id);
          }
        } catch (evalErr: unknown) {
          setError((evalErr as Error).message || 'Failed to trigger evaluation.');
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load submission.');
    } finally {
      setLoading(false);
    }
  }, [submissionId, startPolling, clearPolling]);

  useEffect(() => {
    let active = true;
    async function init() {
      if (!submissionId) return;
      try {
        const sub = await submissionsApi.getSubmission(submissionId);
        if (!active) return;
        setSubmission(sub);

        if (sub.evaluation) {
          setEvaluation(sub.evaluation);
          if (sub.evaluation.status === 'EVALUATING' || sub.evaluation.status === 'PENDING') {
            startPolling(sub.evaluation.id);
          } else {
            clearPolling();
          }
        } else {
          try {
            const evalData = await evaluationsApi.triggerEvaluation(submissionId);
            if (!active) return;
            setEvaluation(evalData);
            if (evalData.status === 'EVALUATING' || evalData.status === 'PENDING') {
              startPolling(evalData.id);
            }
          } catch (evalErr: unknown) {
            if (active) setError((evalErr as Error).message || 'Failed to trigger evaluation.');
          }
        }
      } catch (err: unknown) {
        if (active) setError((err as Error).message || 'Failed to load submission.');
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
      clearPolling();
    };
  }, [submissionId, startPolling, clearPolling]);

  const handleRetryEvaluation = async () => {
    setRetrying(true);
    setError(null);
    try {
      if (evaluation) {
        const retried = await evaluationsApi.retryEvaluation(evaluation.id);
        setEvaluation(retried);
        if (retried.status === 'EVALUATING' || retried.status === 'PENDING') {
          startPolling(retried.id);
        }
      } else if (submissionId) {
        const evalData = await evaluationsApi.triggerEvaluation(submissionId);
        setEvaluation(evalData);
        if (evalData.status === 'EVALUATING' || evalData.status === 'PENDING') {
          startPolling(evalData.id);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  const handleTryAgain = async () => {
    // Look up problem ID from submission attempt if available
    const problemId = (submission as any)?.attempt?.problemId;
    if (!problemId) {
      // Fallback: go to problem library
      navigate('/');
      return;
    }

    setStartingNewAttempt(true);
    setError(null);
    try {
      // Creates a brand new Attempt, preserving the current submission and evaluation intact
      const newAttempt = await attemptsApi.createAttempt(problemId);
      navigate(`/attempts/${newAttempt.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to start a new attempt.');
      setStartingNewAttempt(false);
    }
  };

  if (loading) {
    return <LoadingState message="Retrieving Evaluation..." description="Fetching evaluation scores and criterion feedback" />;
  }

  if (error && !submission) {
    return (
      <ErrorState
        title="Submission Not Found"
        message={error}
        onRetry={loadData}
      />
    );
  }

  const isEvaluating = evaluation?.status === 'EVALUATING' || evaluation?.status === 'PENDING';
  const isCompleted = evaluation?.status === 'COMPLETED';
  const isFailed = evaluation?.status === 'FAILED' || (Boolean(error) && !isCompleted && !isEvaluating);
  const feedbackList = evaluation?.feedback || [];

  return (
    <div className="evaluation-result-page">
      {/* Top action bar */}
      <div className="result-nav-bar">
        <Link to="/" className="btn-secondary nav-back-btn">
          &larr; Problem Library
        </Link>
        <div className="nav-right-actions">
          <button
            type="button"
            className="btn-primary try-again-btn"
            onClick={handleTryAgain}
            disabled={startingNewAttempt}
          >
            {startingNewAttempt ? 'Starting New Attempt...' : 'Try Again (Start New Attempt) \u2192'}
          </button>
        </div>
      </div>

      {error && !isFailed && (
        <div className="result-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Evaluating in Progress State */}
      {isEvaluating && (
        <div className="evaluating-progress-container" role="status" aria-live="polite">
          <div className="spinner-large" />
          <h2 className="evaluating-headline">Evaluating Your Low-Level Design...</h2>
          <p className="evaluating-subtext">
            The Rubric Evaluator is assessing class models, interface boundaries, coupling &amp; cohesion, design patterns, and edge case resilience against the 100-point rubric.
          </p>
          <div className="pipeline-steps">
            <span className="step-badge done">&check; Submission Saved</span>
            <span className="step-arrow">&rarr;</span>
            <span className="step-badge active">Running Rubric Evaluation</span>
            <span className="step-arrow">&rarr;</span>
            <span className="step-badge pending">Synthesizing Feedback</span>
          </div>
        </div>
      )}

      {/* Failed Evaluation State Card */}
      {isFailed && (
        <div className="evaluation-failed-card" role="alert">
          <div className="failed-icon">!</div>
          <h3 className="failed-title">Evaluation Failed</h3>
          <p className="failed-description">
            {evaluation?.errorMessage || error || 'An error occurred while evaluating your submission with the upstream model.'}
          </p>
          <p className="failed-note">
            Your design submission is safely stored and was not lost. You can retry evaluation in-place.
          </p>
          <button
            type="button"
            className="btn-primary retry-eval-btn"
            onClick={handleRetryEvaluation}
            disabled={retrying}
          >
            {retrying ? 'Retrying Evaluation...' : 'Retry Evaluation Now \u2192'}
          </button>
        </div>
      )}

      {/* Completed Evaluation State */}
      {isCompleted && evaluation && (
        <>
          {/* Score Hero Banner */}
          <ScoreDisplay
            totalScore={evaluation.totalScore ?? 0}
            maxScore={evaluation.maxScore ?? 100}
            status={evaluation.status}
            evaluatorType={evaluation.evaluatorType}
          />

          {/* View Mode Toggle Bar */}
          <div className="view-toggle-bar" role="tablist">
            <button
              type="button"
              className={`toggle-tab-btn ${activeView === 'FEEDBACK' ? 'active' : ''}`}
              onClick={() => setActiveView('FEEDBACK')}
              role="tab"
              aria-selected={activeView === 'FEEDBACK'}
            >
              Rubric Feedback Breakdown ({feedbackList.length} Dimensions)
            </button>
            <button
              type="button"
              className={`toggle-tab-btn ${activeView === 'SUBMISSION' ? 'active' : ''}`}
              onClick={() => setActiveView('SUBMISSION')}
              role="tab"
              aria-selected={activeView === 'SUBMISSION'}
            >
              Submitted Design Solution
            </button>
          </div>

          {/* Feedback Breakdown List */}
          {activeView === 'FEEDBACK' && (
            <div className="feedback-cards-container">
              {feedbackList.length === 0 ? (
                <div className="empty-feedback">
                  <p>No criterion feedback recorded for this evaluation.</p>
                </div>
              ) : (
                feedbackList.map((fb, idx) => (
                  <FeedbackCard key={fb.id || idx} feedback={fb} index={idx} />
                ))
              )}
            </div>
          )}

          {/* Submitted Solution View */}
          {activeView === 'SUBMISSION' && submission && (
            <div className="submitted-solution-container">
              <div className="solution-metadata-bar">
                <span>Submitted at: {new Date(submission.submittedAt).toLocaleString()}</span>
                <span>Type: {submission.type}</span>
              </div>
              <pre className="submitted-solution-code">
                {submission.content}
              </pre>
            </div>
          )}

          {/* Bottom Call to Action for Practice Loop */}
          <div className="bottom-try-again-banner">
            <div className="banner-content">
              <h3>Ready to iterate on your architecture?</h3>
              <p>
                Review the identified concerns and actionable suggestions above, refine your class contracts, and start a new attempt.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary start-new-attempt-btn"
              onClick={handleTryAgain}
              disabled={startingNewAttempt}
            >
              {startingNewAttempt ? 'Initializing Attempt...' : 'Start New Attempt (Try Again) \u2192'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
