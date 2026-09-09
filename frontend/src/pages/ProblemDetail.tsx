import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { problemsApi, attemptsApi } from '../api/index.js';
import type { Problem, Rubric, AttemptHistoryItem } from '../types/index.js';
import { AttemptHistory } from '../components/AttemptHistory.js';
import { LoadingState } from '../components/LoadingState.js';
import { ErrorState } from '../components/ErrorState.js';

export const ProblemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [startingAttempt, setStartingAttempt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'STATEMENT' | 'RUBRIC' | 'HISTORY'>('STATEMENT');

  const fetchProblemData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [prob, rub] = await Promise.all([
        problemsApi.getProblem(id),
        problemsApi.getDefaultRubric(),
      ]);
      setProblem(prob);
      setRubric(rub);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load problem details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    if (!id) return;
    setLoadingAttempts(true);
    try {
      const list = await problemsApi.getProblemAttempts(id);
      setAttempts(list);
    } catch {
      // Non-fatal if attempts fail
    } finally {
      setLoadingAttempts(false);
    }
  };

  useEffect(() => {
    fetchProblemData();
    fetchAttempts();
  }, [id]);

  const handleStartAttempt = async () => {
    if (!problem) return;
    setStartingAttempt(true);
    setError(null);
    try {
      const newAttempt = await attemptsApi.createAttempt(problem.id);
      navigate(`/attempts/${newAttempt.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to start a new attempt.');
      setStartingAttempt(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Problem Specification..." description="Fetching requirements, constraints, and rubric" />;
  }

  if (error || !problem) {
    return (
      <ErrorState
        title="Problem Not Found"
        message={error || 'The requested problem could not be located.'}
        onRetry={fetchProblemData}
      />
    );
  }

  const requirements = problem.requirements || [];
  const constraints = problem.constraints || [];
  const criteria = rubric?.criteria || [];

  return (
    <div className="problem-detail-page">
      {/* Back breadcrumb & Action Bar */}
      <div className="action-nav-bar">
        <Link to="/" className="btn-secondary nav-back-btn">
          &larr; Problem Library
        </Link>
        <button
          type="button"
          className="btn-primary start-btn"
          onClick={handleStartAttempt}
          disabled={startingAttempt}
        >
          {startingAttempt ? 'Initializing Attempt...' : 'Start Practice Attempt \u2192'}
        </button>
      </div>

      {/* Header Info */}
      <div className="problem-header-banner">
        <div className="banner-top">
          <span className={`diff-badge ${problem.difficulty?.toLowerCase() || 'medium'}`}>
            {problem.difficulty || 'MEDIUM'}
          </span>
          <span className="slug-tag">#{problem.slug}</span>
        </div>
        <h2 className="banner-title">{problem.title}</h2>
        <p className="banner-desc">{problem.description}</p>
      </div>

      {/* Tabs */}
      <div className="detail-tabs-bar" role="tablist">
        <button
          type="button"
          className={`detail-tab ${activeTab === 'STATEMENT' ? 'active' : ''}`}
          onClick={() => setActiveTab('STATEMENT')}
          role="tab"
          aria-selected={activeTab === 'STATEMENT'}
        >
          Problem Statement &amp; Requirements
        </button>
        <button
          type="button"
          className={`detail-tab ${activeTab === 'RUBRIC' ? 'active' : ''}`}
          onClick={() => setActiveTab('RUBRIC')}
          role="tab"
          aria-selected={activeTab === 'RUBRIC'}
        >
          Evaluation Rubric (100 pts)
        </button>
        <button
          type="button"
          className={`detail-tab ${activeTab === 'HISTORY' ? 'active' : ''}`}
          onClick={() => setActiveTab('HISTORY')}
          role="tab"
          aria-selected={activeTab === 'HISTORY'}
        >
          Past Attempts ({attempts.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-body">
        {activeTab === 'STATEMENT' && (
          <div className="statement-tab-grid">
            <div className="spec-card">
              <h3 className="card-section-title">Problem Statement</h3>
              <div className="statement-prose">
                <p>{problem.problemStatement || problem.description}</p>
              </div>
            </div>

            <div className="spec-card">
              <h3 className="card-section-title">Functional Requirements ({requirements.length})</h3>
              <ul className="requirements-list">
                {requirements.map((req, idx) => (
                  <li key={idx} className="requirement-item">
                    <span className="req-index">{idx + 1}</span>
                    <span className="req-text">{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {constraints.length > 0 && (
              <div className="spec-card">
                <h3 className="card-section-title">Assumptions &amp; System Constraints</h3>
                <ul className="constraints-list">
                  {constraints.map((c, idx) => (
                    <li key={idx} className="constraint-item">
                      &bull; {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'RUBRIC' && (
          <div className="rubric-tab-content">
            <div className="rubric-intro-banner">
              <h3>Database-Backed 100-Point Evaluation Rubric</h3>
              <p>
                When you submit your LLD design, the LLM Evaluator evaluates your architecture against each of these 7 dimensions independently:
              </p>
            </div>

            <div className="criteria-grid">
              {criteria.map((crit) => (
                <div key={crit.id} className="criterion-info-card">
                  <div className="crit-card-top">
                    <span className="crit-num">#{crit.orderIndex}</span>
                    <span className="crit-pts">{crit.maxScore} pts</span>
                  </div>
                  <h4 className="crit-title">{crit.name}</h4>
                  <p className="crit-description">{crit.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="history-tab-content">
            <div className="history-header">
              <h3>Your Past Attempts on this Problem</h3>
              <p>Every practice attempt is preserved with full submission content and evaluation feedback.</p>
            </div>
            <AttemptHistory
              attempts={attempts}
              loading={loadingAttempts}
              onStartNewAttempt={handleStartAttempt}
            />
          </div>
        )}
      </div>
    </div>
  );
};
