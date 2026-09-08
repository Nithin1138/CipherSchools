import React from 'react';
import type { Problem } from '../types/index.js';

interface ProblemListProps {
  problems: Problem[];
  onSelectProblem: (problem: Problem) => void;
  loading: boolean;
}

export const ProblemList: React.FC<ProblemListProps> = ({ problems, onSelectProblem, loading }) => {
  if (loading) {
    return <div className="loading-state">Loading LLD problems...</div>;
  }

  const getDifficultyClass = (difficulty: string) => {
    switch (difficulty.toUpperCase()) {
      case 'EASY':
        return 'diff-badge easy';
      case 'HARD':
        return 'diff-badge hard';
      default:
        return 'diff-badge medium';
    }
  };

  return (
    <div className="problem-list-container">
      <div className="section-header">
        <h2>Practice Problems</h2>
        <p className="section-desc">
          Select an architectural challenge to design, submit, and receive rubric-driven feedback.
        </p>
      </div>

      <div className="problem-grid">
        {problems.map((prob) => (
          <div
            key={prob.id}
            className="problem-card"
            onClick={() => onSelectProblem(prob)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectProblem(prob);
            }}
          >
            <div className="problem-card-header">
              <span className={getDifficultyClass(prob.difficulty)}>{prob.difficulty}</span>
              <span className="slug-tag">#{prob.slug}</span>
            </div>
            <h3 className="problem-title">{prob.title}</h3>
            <p className="problem-desc">{prob.description}</p>
            <div className="problem-card-footer">
              <span className="action-link">Open Challenge &rarr;</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
