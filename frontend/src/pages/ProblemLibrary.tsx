import React, { useState, useEffect } from 'react';
import { problemsApi } from '../api/index.js';
import type { Problem } from '../types/index.js';
import { ProblemCard } from '../components/ProblemCard.js';
import { LoadingState } from '../components/LoadingState.js';
import { ErrorState } from '../components/ErrorState.js';

export const ProblemLibrary: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');

  const fetchProblems = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await problemsApi.listProblems();
      setProblems(list);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load problems.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const filteredProblems = problems.filter((p) => {
    if (selectedDifficulty === 'ALL') return true;
    return p.difficulty?.toUpperCase() === selectedDifficulty;
  });

  if (loading) {
    return <LoadingState message="Loading LLD Practice Library..." description="Fetching problem statements and rubric specs" />;
  }

  if (error) {
    return <ErrorState title="Failed to Load Problems" message={error} onRetry={fetchProblems} />;
  }

  return (
    <div className="problem-library-page">
      <div className="page-hero">
        <div className="page-hero-content">
          <span className="page-kicker">Low-Level Design Practice</span>
          <h2 className="page-title">Curated Architecture Challenges</h2>
          <p className="page-subtitle">
            Practice designing object-oriented systems with real-world constraints. Submit your architecture and receive instant, rubric-grounded feedback with concrete evidence and actionable improvements.
          </p>
        </div>

        {/* Filter bar */}
        <div className="filter-pill-group" role="tablist" aria-label="Difficulty Filter">
          {['ALL', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
            <button
              key={diff}
              type="button"
              className={`filter-pill ${selectedDifficulty === diff ? 'active' : ''}`}
              onClick={() => setSelectedDifficulty(diff)}
              role="tab"
              aria-selected={selectedDifficulty === diff}
            >
              {diff === 'ALL' ? 'All Difficulties' : diff}
            </button>
          ))}
        </div>
      </div>

      {filteredProblems.length === 0 ? (
        <div className="empty-results-box">
          <p>No problems found for difficulty &quot;{selectedDifficulty}&quot;.</p>
          <button type="button" className="btn-secondary" onClick={() => setSelectedDifficulty('ALL')}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="problem-grid">
          {filteredProblems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
        </div>
      )}
    </div>
  );
};
