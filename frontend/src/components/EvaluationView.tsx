import React, { useState } from 'react';
import type { Evaluation, Submission, Problem } from '../types/index.js';

interface EvaluationViewProps {
  problem: Problem;
  submission: Submission;
  evaluation: Evaluation;
  onTryAgain: () => void;
  onRetryEvaluation: () => void;
  retrying: boolean;
  onBackToProblems: () => void;
}

export const EvaluationView: React.FC<EvaluationViewProps> = ({
  problem,
  submission,
  evaluation,
  onTryAgain,
  onRetryEvaluation,
  retrying,
  onBackToProblems,
}) => {
  const [activeView, setActiveView] = useState<'FEEDBACK' | 'SUBMISSION'>('FEEDBACK');

  const totalScore = evaluation.totalScore ?? 0;
  const maxScore = evaluation.maxScore ?? 100;
  const percentage = Math.round((totalScore / maxScore) * 100);

  const getScoreBadgeClass = (pct: number) => {
    if (pct >= 85) return 'grade-badge excellent';
    if (pct >= 70) return 'grade-badge good';
    if (pct >= 50) return 'grade-badge average';
    return 'grade-badge needs-work';
  };

  const getScoreGrade = (pct: number) => {
    if (pct >= 85) return 'Strong LLD Design';
    if (pct >= 70) return 'Solid / Promising Design';
    if (pct >= 50) return 'Acceptable with Clear Gaps';
    return 'Needs Fundamental Rework';
  };

  return (
    <div className="evaluation-view-container">
      {/* Top action bar */}
      <div className="eval-nav-bar">
        <button type="button" className="btn-secondary" onClick={onBackToProblems}>
          &larr; Problem Selection
        </button>
        <div className="nav-right">
          <button type="button" className="btn-primary retry-attempt-btn" onClick={onTryAgain}>
            Try Again (Start New Attempt) &rarr;
          </button>
        </div>
      </div>

      {/* Hero score banner */}
      <div className="score-hero-card">
        <div className="score-main">
          <span className="hero-label">Evaluation Outcome &bull; {problem.title}</span>
          <div className="score-display">
            <span className="big-number">{totalScore}</span>
            <span className="total-denominator">/ {maxScore}</span>
          </div>
          <span className={getScoreBadgeClass(percentage)}>
            {percentage}% &bull; {getScoreGrade(percentage)}
          </span>
        </div>

        <div className="eval-metadata">
          <p>
            <strong>Evaluator:</strong> {evaluation.evaluatorType} Evaluator
          </p>
          <p>
            <strong>Status:</strong>{' '}
            <span className={`status-pill ${evaluation.status.toLowerCase()}`}>{evaluation.status}</span>
          </p>
          <p>
            <strong>Submitted:</strong> {new Date(submission.submittedAt).toLocaleString()}
          </p>
          {evaluation.completedAt && (
            <p>
              <strong>Evaluated:</strong> {new Date(evaluation.completedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Failure state handling */}
      {evaluation.status === 'FAILED' && (
        <div className="failure-banner">
          <h4>Evaluation Failed</h4>
          <p>{evaluation.errorMessage || 'An unexpected error occurred during evaluation.'}</p>
          <p className="note">Your design is safely stored. Click below to retry evaluation in-place.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={onRetryEvaluation}
            disabled={retrying}
          >
            {retrying ? 'Retrying Evaluation...' : 'Retry Evaluation Now'}
          </button>
        </div>
      )}

      {/* View Switcher */}
      <div className="view-toggle-bar">
        <button
          type="button"
          className={`toggle-btn ${activeView === 'FEEDBACK' ? 'active' : ''}`}
          onClick={() => setActiveView('FEEDBACK')}
        >
          Rubric Feedback Breakdown ({evaluation.feedback?.length || 0} Dimensions)
        </button>
        <button
          type="button"
          className={`toggle-btn ${activeView === 'SUBMISSION' ? 'active' : ''}`}
          onClick={() => setActiveView('SUBMISSION')}
        >
          My Submitted Design Text
        </button>
      </div>

      {/* Content */}
      {activeView === 'FEEDBACK' && (
        <div className="feedback-breakdown">
          {(!evaluation.feedback || evaluation.feedback.length === 0) && evaluation.status === 'COMPLETED' ? (
            <p>No feedback items found for this evaluation.</p>
          ) : (
            evaluation.feedback.map((item, idx) => {
              const itemPct = Math.round((item.score / item.maxScore) * 100);
              return (
                <div key={item.id || idx} className="criterion-feedback-card">
                  <div className="criterion-card-header">
                    <div className="header-left">
                      <span className="crit-badge">Criterion #{idx + 1}</span>
                      <h4>{item.criterionName}</h4>
                    </div>
                    <div className="header-right">
                      <span className="score-tag">
                        <strong>{item.score}</strong> / {item.maxScore} pts
                      </span>
                      <div className="mini-progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${itemPct}%`,
                            backgroundColor: itemPct >= 80 ? '#10b981' : itemPct >= 60 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="feedback-content-grid">
                    {/* Evidence */}
                    <div className="feedback-box evidence-box">
                      <h5>Evidence from Candidate Design:</h5>
                      <p className="quote-text">&ldquo;{item.evidence}&rdquo;</p>
                    </div>

                    {/* Concern */}
                    {item.concern && (
                      <div className="feedback-box concern-box">
                        <h5>Identified Concern / Risk:</h5>
                        <p>{item.concern}</p>
                      </div>
                    )}

                    {/* Suggestion */}
                    {item.suggestion && (
                      <div className="feedback-box suggestion-box">
                        <h5>Actionable Recommendation for Next Attempt:</h5>
                        <p>{item.suggestion}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeView === 'SUBMISSION' && (
        <div className="submission-content-view">
          <div className="raw-submission-box">
            <pre>{submission.content}</pre>
          </div>
        </div>
      )}

      {/* Footer next action */}
      <div className="bottom-loop-box">
        <h3>Ready to improve your design?</h3>
        <p>Review the suggestions above, refine your classes and relationships, and submit a new attempt.</p>
        <button type="button" className="btn-primary big-btn" onClick={onTryAgain}>
          Start Next Attempt &rarr;
        </button>
      </div>
    </div>
  );
};
