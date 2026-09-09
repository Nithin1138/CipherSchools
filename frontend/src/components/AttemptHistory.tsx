import React from 'react';
import { Link } from 'react-router-dom';
import type { AttemptHistoryItem } from '../types/index.js';

interface AttemptHistoryProps {
  attempts: AttemptHistoryItem[];
  loading: boolean;
  onStartNewAttempt: () => void;
}

export const AttemptHistory: React.FC<AttemptHistoryProps> = ({
  attempts,
  loading,
  onStartNewAttempt,
}) => {
  if (loading) {
    return <div className="history-loading">Loading past practice attempts...</div>;
  }

  if (!attempts || attempts.length === 0) {
    return (
      <div className="empty-history-box">
        <p className="empty-title">No Practice Attempts Yet</p>
        <p className="empty-desc">
          You haven&apos;t started an attempt for this problem. Review the requirements and click below to begin.
        </p>
        <button type="button" className="btn-primary" onClick={onStartNewAttempt}>
          Start First Attempt &rarr;
        </button>
      </div>
    );
  }

  return (
    <div className="attempt-history-table-container">
      <table className="attempt-history-table">
        <thead>
          <tr>
            <th>Attempt</th>
            <th>Date Started</th>
            <th>Status</th>
            <th>Score</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((att, idx) => {
            const attemptNum = attempts.length - idx;
            const evalData = att.submission?.evaluation;
            const evalStatus = evalData?.status || (att.submission ? 'SUBMITTED' : att.status);
            const score = evalData?.totalScore;
            const submissionId = att.submission?.id;

            return (
              <tr key={att.id}>
                <td className="attempt-num-cell">
                  <strong>Attempt #{attemptNum}</strong>
                </td>
                <td className="date-cell">{new Date(att.startedAt).toLocaleString()}</td>
                <td className="status-cell">
                  <span className={`status-pill status-${evalStatus.toLowerCase()}`}>
                    {evalStatus}
                  </span>
                </td>
                <td className="score-cell">
                  {score !== undefined && score !== null ? (
                    <strong className="score-value">{score} / 100</strong>
                  ) : (
                    <span className="muted-dash">-</span>
                  )}
                </td>
                <td className="action-cell">
                  {submissionId ? (
                    <Link
                      to={`/submissions/${submissionId}`}
                      className="btn-secondary btn-sm"
                    >
                      View Feedback &rarr;
                    </Link>
                  ) : (
                    <Link
                      to={`/attempts/${att.id}`}
                      className="btn-primary btn-sm"
                    >
                      Resume Editor &rarr;
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
