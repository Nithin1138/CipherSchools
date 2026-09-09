import React from 'react';

interface ScoreDisplayProps {
  totalScore: number;
  maxScore: number;
  status: string;
  evaluatorType?: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  totalScore,
  maxScore,
  status,
  evaluatorType,
}) => {
  const percentage = Math.round((totalScore / (maxScore || 100)) * 100);

  const getScoreColor = (pct: number) => {
    if (pct >= 85) return 'var(--color-success, #10b981)';
    if (pct >= 70) return 'var(--color-accent, #3b82f6)';
    if (pct >= 50) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  };

  const getGradeText = (pct: number) => {
    if (pct >= 85) return 'Exceptional Architecture';
    if (pct >= 70) return 'Solid Design with Minor Gaps';
    if (pct >= 50) return 'Acceptable Design with Key Gaps';
    return 'Needs Fundamental Rework';
  };

  return (
    <div className="score-hero-container">
      <div className="score-top-row">
        <div>
          <span className="score-kicker">Evaluation Score</span>
          <div className="score-number-row">
            <span className="score-big">{totalScore}</span>
            <span className="score-max">/ {maxScore}</span>
          </div>
          <span className="score-grade-badge" style={{ borderColor: getScoreColor(percentage) }}>
            {percentage}% &bull; {getGradeText(percentage)}
          </span>
        </div>

        <div className="score-meta-pills">
          <div className="meta-pill">
            <span className="meta-label">Status</span>
            <span className={`status-tag status-${status.toLowerCase()}`}>{status}</span>
          </div>
          {evaluatorType && (
            <div className="meta-pill">
              <span className="meta-label">Engine</span>
              <span className="meta-value">{evaluatorType}</span>
            </div>
          )}
        </div>
      </div>

      <div className="score-progress-track" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="score-progress-bar"
          style={{
            width: `${percentage}%`,
            backgroundColor: getScoreColor(percentage),
          }}
        />
      </div>
    </div>
  );
};
