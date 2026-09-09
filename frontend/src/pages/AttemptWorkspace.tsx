import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { attemptsApi, submissionsApi, evaluationsApi } from '../api/index.js';
import type { Attempt, Problem } from '../types/index.js';
import { LoadingState } from '../components/LoadingState.js';
import { ErrorState } from '../components/ErrorState.js';

const STARTER_TEMPLATE = `## 1. Requirements & Scope
- Functional Scope:
- Assumptions:

## 2. Core Domain Entities & Class Models
- Class Name:
  - Properties:
  - Methods:
  - Single Responsibility:

## 3. Interfaces & Design Patterns
- Interfaces / Contracts:
- Patterns Applied (Strategy, Factory, Observer, State):
- Dependency Management:

## 4. Key Workflows & Sequences
- Workflow 1:

## 5. Extensibility & Open-Closed Principle
- How new requirements/types can be added without altering existing classes:

## 6. Edge Cases, Concurrency & Testability
- Concurrency / Thread-Safety handling:
- Boundary conditions & failure handling:
`;

export const AttemptWorkspace: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState(STARTER_TEMPLATE);

  // Storage key to prevent losing work on accidental reload
  const storageKey = attemptId ? `lld_draft_${attemptId}` : null;

  useEffect(() => {
    async function loadAttemptData() {
      if (!attemptId) return;
      setLoading(true);
      setError(null);
      try {
        const att = await attemptsApi.getAttempt(attemptId);
        setAttempt(att);
        if (att.problem) {
          setProblem(att.problem);
        }

        // If this attempt already has a submission, redirect to its evaluation
        if (att.submission) {
          navigate(`/submissions/${att.submission.id}`);
          return;
        }

        // Load saved draft if available
        if (storageKey) {
          const savedDraft = localStorage.getItem(storageKey);
          if (savedDraft && savedDraft.trim().length > 0) {
            setContent(savedDraft);
          }
        }
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load attempt.');
      } finally {
        setLoading(false);
      }
    }

    loadAttemptData();
  }, [attemptId, navigate, storageKey]);

  const handleContentChange = (val: string) => {
    setContent(val);
    if (storageKey) {
      localStorage.setItem(storageKey, val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attemptId) return;

    if (!content || content.trim().length < 20) {
      setError('Please provide a substantive design submission (minimum 20 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create submission (Save-before-evaluate guarantee)
      const submission = await submissionsApi.createSubmission(attemptId, content.trim());

      // Clear local draft upon successful submission
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }

      // 2. Trigger evaluation asynchronously
      // Even if triggerEvaluation takes a moment or runs async, navigate to evaluation page immediately
      try {
        evaluationsApi.triggerEvaluation(submission.id).catch((evalErr) => {
          console.warn('Evaluation trigger background status:', evalErr);
        });
      } catch {
        // Handled on result page
      }

      // 3. Navigate to evaluation result experience
      navigate(`/submissions/${submission.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Submission failed. Your draft has been kept safe.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Setting Up Practice Workspace..." description="Loading attempt state and problem constraints" />;
  }

  if (error && !attempt) {
    return (
      <ErrorState
        title="Workspace Error"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const charCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const requirements = problem?.requirements || [];
  const constraints = problem?.constraints || [];

  return (
    <div className="attempt-workspace-page">
      {/* Workspace Top Header */}
      <header className="workspace-header">
        <div className="workspace-title-group">
          <Link to={`/problems/${problem?.id}`} className="workspace-back-link">
            &larr; Exit Workspace
          </Link>
          <div className="title-and-pill">
            <h2 className="workspace-heading">{problem?.title || 'LLD Practice Workspace'}</h2>
            <span className="attempt-pill">Active Attempt</span>
          </div>
        </div>

        <div className="workspace-header-actions">
          <button
            type="button"
            className="btn-primary submit-design-btn"
            onClick={handleSubmit}
            disabled={submitting || charCount < 20}
          >
            {submitting ? 'Submitting...' : 'Submit Design for Evaluation \u2192'}
          </button>
        </div>
      </header>

      {/* Error alert bar */}
      {error && (
        <div className="workspace-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            &times;
          </button>
        </div>
      )}

      {/* 2-Column Split Workspace */}
      <div className="workspace-split-layout">
        {/* Left Column: Pinned Problem & Rubric Reference */}
        <aside className="workspace-reference-column" aria-label="Problem Reference">
          <div className="ref-scroll-container">
            <div className="ref-card">
              <h3 className="ref-card-title">Problem Statement</h3>
              <p className="ref-statement-text">
                {problem?.problemStatement || problem?.description}
              </p>
            </div>

            <div className="ref-card">
              <h3 className="ref-card-title">Functional Requirements ({requirements.length})</h3>
              <ul className="ref-list">
                {requirements.map((req, idx) => (
                  <li key={idx}>
                    <strong>{idx + 1}.</strong> {req}
                  </li>
                ))}
              </ul>
            </div>

            {constraints.length > 0 && (
              <div className="ref-card">
                <h3 className="ref-card-title">Constraints &amp; Assumptions</h3>
                <ul className="ref-list bulleted">
                  {constraints.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ref-card rubric-summary-card">
              <h3 className="ref-card-title">Rubric Evaluation Dimensions (100 pts)</h3>
              <div className="rubric-mini-list">
                <div className="rubric-mini-item">
                  <span>1. Requirement Understanding</span>
                  <strong>15 pts</strong>
                </div>
                <div className="rubric-mini-item">
                  <span>2. Class Responsibilities (SRP)</span>
                  <strong>20 pts</strong>
                </div>
                <div className="rubric-mini-item">
                  <span>3. Encapsulation &amp; Interfaces</span>
                  <strong>15 pts</strong>
                </div>
                <div className="rubric-mini-item">
                  <span>4. Coupling &amp; Cohesion</span>
                  <strong>15 pts</strong>
                </div>
                <div className="rubric-mini-item">
                  <span>5. Abstraction &amp; Design Patterns</span>
                  <strong>10 pts</strong>
                </div>
                <div className="rubric-mini-item">
                  <span>6. Extensibility (OCP)</span>
                  <strong>15 pts</strong>
                </div>
                <div className="rubric-mini-item">
                  <span>7. Edge Cases &amp; Testability</span>
                  <strong>10 pts</strong>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Solution Editor */}
        <main className="workspace-editor-column" aria-label="Solution Editor">
          <div className="editor-top-bar">
            <div className="editor-mode-label">
              <span className="dot-live" />
              <span>Design Solution (Markdown / Text)</span>
            </div>
            <div className="editor-stats">
              <span>{wordCount} words</span>
              <span>&bull;</span>
              <span className={charCount < 20 ? 'count-insufficient' : 'count-sufficient'}>
                {charCount} characters {charCount < 20 ? '(min 20)' : ''}
              </span>
            </div>
          </div>

          <div className="editor-textarea-wrapper">
            <label htmlFor="solution-editor-textarea" className="sr-only">
              Low-Level Design Solution Text
            </label>
            <textarea
              id="solution-editor-textarea"
              className="solution-textarea"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your object-oriented design, class relationships, methods, and trade-offs here..."
              disabled={submitting}
              autoFocus
              spellCheck={false}
            />
          </div>

          <div className="editor-bottom-bar">
            <span className="draft-saved-notice">
              Draft auto-saved locally in browser
            </span>
            <button
              type="button"
              className="btn-primary submit-design-btn-bottom"
              onClick={handleSubmit}
              disabled={submitting || charCount < 20}
            >
              {submitting ? 'Submitting...' : 'Submit Design \u2192'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
