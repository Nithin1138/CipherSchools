import React, { useState, useEffect } from 'react';
import type { Problem, Rubric, AttemptHistoryItem } from '../types/index.js';
import { api } from '../api/client.js';

interface ProblemDetailProps {
  problem: Problem;
  rubric: Rubric | null;
  onStartAttempt: () => void;
  onViewAttempt: (attemptId: string) => void;
  onBack: () => void;
}

export const ProblemDetail: React.FC<ProblemDetailProps> = ({
  problem: initialProblem,
  rubric,
  onStartAttempt,
  onViewAttempt,
  onBack,
}) => {
  const [problem, setProblem] = useState<Problem>(initialProblem);
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'RUBRIC' | 'HISTORY'>('DETAILS');

  // Ensure full problem data (requirements, constraints) is loaded
  useEffect(() => {
    setProblem(initialProblem);
    if (!initialProblem.requirements || initialProblem.requirements.length === 0) {
      api.getProblem(initialProblem.id)
        .then((fullProb) => setProblem(fullProb))
        .catch((err) => console.error('Error fetching full problem details:', err));
    }
  }, [initialProblem]);

  useEffect(() => {
    api.getProblemAttempts(problem.id)
      .then((data) => {
        setAttempts(data || []);
        setLoadingAttempts(false);
      })
      .catch((err) => {
        console.error('Failed to load attempts:', err);
        setLoadingAttempts(false);
      });
  }, [problem.id]);

  const difficulty = problem.difficulty || 'MEDIUM';
  const requirements = problem.requirements || [];
  const constraints = problem.constraints || [];

  return (
    <div className="problem-detail-container">
      <div className="detail-nav">
        <button type="button" className="btn-secondary" onClick={onBack}>
          &larr; Back to Problems
        </button>
        <button type="button" className="btn-primary" onClick={onStartAttempt}>
          Start Practice Attempt &rarr;
        </button>
      </div>

      <div className="problem-header-box">
        <div className="title-row">
          <h1>{problem.title}</h1>
          <span className={`diff-badge ${difficulty.toLowerCase()}`}>
            {difficulty}
          </span>
        </div>
        <p className="lead-desc">{problem.description}</p>
      </div>

      <div className="tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'DETAILS' ? 'active' : ''}`}
          onClick={() => setActiveTab('DETAILS')}
        >
          Problem Statement &amp; Requirements
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'RUBRIC' ? 'active' : ''}`}
          onClick={() => setActiveTab('RUBRIC')}
        >
          Evaluation Rubric (100 pts)
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'HISTORY' ? 'active' : ''}`}
          onClick={() => setActiveTab('HISTORY')}
        >
          My Past Attempts ({attempts.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'DETAILS' && (
          <div className="details-section">
            <div className="card-box">
              <h3>Problem Statement</h3>
              <p className="statement-text">{problem.problemStatement || problem.description}</p>
            </div>

            <div className="card-box">
              <h3>Functional Requirements</h3>
              {requirements.length === 0 ? (
                <p className="muted-text">Loading requirements...</p>
              ) : (
                <ul className="req-list">
                  {requirements.map((req, i) => (
                    <li key={i}>
                      <strong>{i + 1}.</strong> {req}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {constraints.length > 0 && (
              <div className="card-box">
                <h3>Assumptions &amp; Constraints</h3>
                <ul className="constraint-list">
                  {constraints.map((c, i) => (
                    <li key={i}>&bull; {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'RUBRIC' && (
          <div className="rubric-section">
            <div className="rubric-intro">
              <h3>Standard 100-Point LLD Evaluation Rubric</h3>
              <p>Your design will be evaluated by the LLM Evaluator across these 7 distinct dimensions:</p>
            </div>
            <div className="criteria-list">
              {(rubric?.criteria || []).map((crit) => (
                <div key={crit.id} className="criterion-card">
                  <div className="crit-header">
                    <span className="crit-order">#{crit.orderIndex}</span>
                    <h4>{crit.name}</h4>
                    <span className="crit-score-badge">{crit.maxScore} pts</span>
                  </div>
                  <p className="crit-desc">{crit.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="history-section">
            <h3>Previous Attempts on this Problem</h3>
            {loadingAttempts ? (
              <p>Loading attempt history...</p>
            ) : attempts.length === 0 ? (
              <div className="empty-history">
                <p>No attempts recorded yet for this problem.</p>
                <button type="button" className="btn-primary" onClick={onStartAttempt}>
                  Start First Attempt
                </button>
              </div>
            ) : (
              <div className="attempts-table-wrapper">
                <table className="attempts-table">
                  <thead>
                    <tr>
                      <th>Attempt</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((att, idx) => {
                      const score = att.submission?.evaluation?.totalScore;
                      const evalStatus = att.submission?.evaluation?.status;
                      return (
                        <tr key={att.id}>
                          <td>Attempt #{attempts.length - idx}</td>
                          <td>{new Date(att.startedAt).toLocaleString()}</td>
                          <td>
                            <span className={`status-pill ${att.status.toLowerCase()}`}>
                              {evalStatus || att.status}
                            </span>
                          </td>
                          <td>
                            {score !== undefined && score !== null ? (
                              <strong className="score-text">{score} / 100</strong>
                            ) : (
                              <span className="muted-text">-</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-small"
                              onClick={() => onViewAttempt(att.id)}
                            >
                              Review &rarr;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
