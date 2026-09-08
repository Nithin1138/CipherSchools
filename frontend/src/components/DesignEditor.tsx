import React, { useState } from 'react';
import type { Problem, Attempt } from '../types/index.js';

interface DesignEditorProps {
  problem: Problem;
  attempt: Attempt;
  onSubmit: (content: string) => void;
  submitting: boolean;
  onCancel: () => void;
}

const STARTER_TEMPLATE = `## 1. Requirements & Assumptions
- Scope: 
- Assumptions: 

## 2. Core Entities & Class Models
- Class Name:
  - Attributes:
  - Methods:
  - Responsibility:

## 3. Relationships & Interfaces
- Interfaces / Contracts:
- Design Patterns Applied (e.g. Strategy, Factory, State):
- Dependency Management:

## 4. Workflows & State Transitions
- Key Lifecycle / Flow:

## 5. Extensibility & Trade-offs
- How new requirements are added without modifying existing code (OCP):
- Identified trade-offs:

## 6. Edge Cases & Concurrency
- Boundary conditions:
- Thread-safety / race conditions handling:
`;

export const DesignEditor: React.FC<DesignEditorProps> = ({
  problem,
  attempt: _attempt,
  onSubmit,
  submitting,
  onCancel,
}) => {
  const [content, setContent] = useState(STARTER_TEMPLATE);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || content.trim().length < 20) {
      setError('Please provide a substantive design submission (minimum 20 characters).');
      return;
    }
    setError(null);
    onSubmit(content);
  };

  const charCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div>
          <h2>Working on: {problem.title}</h2>
          <p className="subtitle">
            Structure your Low-Level Design below. Be clear on class responsibilities, abstractions, and trade-offs.
          </p>
        </div>
        <div className="editor-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary submit-btn"
            onClick={handleSubmit}
            disabled={submitting || charCount < 20}
          >
            {submitting ? 'Submitting & Evaluating...' : 'Submit Design for Evaluation \u2192'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="editor-split-view">
        {/* Left column: Problem quick reference */}
        <aside className="editor-reference-pane">
          <h3>Problem Reference</h3>
          <div className="ref-section">
            <h4>Requirements:</h4>
            <ul>
              {(problem.requirements || []).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          {problem.constraints && problem.constraints.length > 0 && (
            <div className="ref-section">
              <h4>Constraints:</h4>
              <ul>
                {(problem.constraints || []).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rubric-hint">
            <h4>Evaluation Dimensions</h4>
            <p>1. Requirement Understanding (15)</p>
            <p>2. Class Responsibilities (20)</p>
            <p>3. Encapsulation &amp; Interfaces (15)</p>
            <p>4. Coupling &amp; Cohesion (15)</p>
            <p>5. Abstraction / Patterns (10)</p>
            <p>6. Extensibility (15)</p>
            <p>7. Edge Cases &amp; Testability (10)</p>
          </div>
        </aside>

        {/* Right column: Design text editor */}
        <main className="editor-main-pane">
          <div className="editor-toolbar">
            <span className="toolbar-title">Markdown Design Editor</span>
            <span className="stats-badge">
              {wordCount} words &bull; {charCount} characters
            </span>
          </div>
          <textarea
            className="design-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your design here..."
            disabled={submitting}
            rows={24}
          />
        </main>
      </div>
    </div>
  );
};
