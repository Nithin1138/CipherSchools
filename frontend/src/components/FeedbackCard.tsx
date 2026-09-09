import React from 'react';
import type { CriterionFeedback } from '../types/index.js';

interface FeedbackCardProps {
  feedback: CriterionFeedback;
  index: number;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ feedback, index }) => {
  const percentage = Math.round((feedback.score / (feedback.maxScore || 1)) * 100);

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return 'var(--color-success, #10b981)';
    if (pct >= 60) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  };

  return (
    <div className="criterion-feedback-card">
      <div className="feedback-card-header">
        <div className="header-title-group">
          <span className="criterion-number">Criterion #{index + 1}</span>
          <h4 className="criterion-name">{feedback.criterionName}</h4>
        </div>

        <div className="header-score-group">
          <div className="score-label">
            <span className="current-score">{feedback.score}</span>
            <span className="max-score">/ {feedback.maxScore} pts</span>
          </div>
          <div className="mini-progress-track">
            <div
              className="mini-progress-fill"
              style={{
                width: `${percentage}%`,
                backgroundColor: getScoreColor(percentage),
              }}
            />
          </div>
        </div>
      </div>

      <div className="feedback-card-body">
        {/* Evidence from design */}
        <div className="feedback-block evidence-block">
          <h5 className="block-heading">
            <span className="block-icon">&rdquo;</span>
            Evidence in Candidate Submission
          </h5>
          <p className="block-content evidence-text">&ldquo;{feedback.evidence}&rdquo;</p>
        </div>

        {/* Concern or vulnerability */}
        {feedback.concern && (
          <div className="feedback-block concern-block">
            <h5 className="block-heading">
              <span className="block-icon">&bull;</span>
              Identified Concern / Architectural Risk
            </h5>
            <p className="block-content concern-text">{feedback.concern}</p>
          </div>
        )}

        {/* Actionable suggestion */}
        {feedback.suggestion && (
          <div className="feedback-block suggestion-block">
            <h5 className="block-heading">
              <span className="block-icon">&rarr;</span>
              Actionable Recommendation for Next Attempt
            </h5>
            <p className="block-content suggestion-text">{feedback.suggestion}</p>
          </div>
        )}
      </div>

      {feedback.confidence !== undefined && feedback.confidence !== null && (
        <div className="feedback-card-footer">
          <span className="confidence-metric">
            Evaluator Confidence: <strong>{Math.round(feedback.confidence * 100)}%</strong>
          </span>
        </div>
      )}
    </div>
  );
};
