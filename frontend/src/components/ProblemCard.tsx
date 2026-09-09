import React from 'react';
import { Link } from 'react-router-dom';
import type { Problem } from '../types/index.js';

interface ProblemCardProps {
  problem: Problem;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({ problem }) => {
  const difficulty = problem.difficulty?.toUpperCase() || 'MEDIUM';

  const getDifficultyClass = (diff: string) => {
    switch (diff) {
      case 'EASY':
        return 'diff-badge easy';
      case 'HARD':
        return 'diff-badge hard';
      default:
        return 'diff-badge medium';
    }
  };

  return (
    <div className="problem-card">
      <div className="problem-card-header">
        <span className={getDifficultyClass(difficulty)}>{difficulty}</span>
        <span className="slug-tag">#{problem.slug}</span>
      </div>

      <h3 className="problem-title">{problem.title}</h3>
      <p className="problem-desc">{problem.description}</p>

      <div className="problem-card-footer">
        <span className="requirements-counter">
          {problem.requirements?.length || 0} core requirements
        </span>
        <Link
          to={`/problems/${problem.id}`}
          className="btn-primary action-btn"
          aria-label={`Practice ${problem.title}`}
        >
          Practice &rarr;
        </Link>
      </div>
    </div>
  );
};
