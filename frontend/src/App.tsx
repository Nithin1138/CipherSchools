import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import { problemsApi } from './api/index.js';
import { ProblemLibrary } from './pages/ProblemLibrary.js';
import { ProblemDetail } from './pages/ProblemDetail.js';
import { AttemptWorkspace } from './pages/AttemptWorkspace.js';
import { EvaluationResult } from './pages/EvaluationResult.js';

function NavigationHeader() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    problemsApi
      .getHealth()
      .then((res) => setBackendOnline(res.status === 'ok'))
      .catch(() => setBackendOnline(false));
  }, []);

  return (
    <header className="platform-header">
      <div className="header-inner">
        <Link to="/" className="header-brand">
          <div className="brand-badge">LLD</div>
          <div className="brand-text">
            <span className="brand-name">LLD Practice Platform</span>
            <span className="brand-tagline">Object-Oriented Design &bull; Rubric Evaluation</span>
          </div>
        </Link>

        <nav className="header-nav" aria-label="Main Navigation">
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Problem Library
          </Link>

          <div className="backend-indicator" title={backendOnline ? 'Backend API connected' : 'Backend connection failing'}>
            <span className={`status-dot ${backendOnline === true ? 'online' : backendOnline === false ? 'offline' : 'checking'}`} />
            <span className="indicator-label">
              {backendOnline === true ? 'Backend API Connected' : backendOnline === false ? 'Backend Offline' : 'Connecting...'}
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="platform-layout">
        <NavigationHeader />

        <main className="platform-main-container">
          <Routes>
            <Route path="/" element={<ProblemLibrary />} />
            <Route path="/problems/:id" element={<ProblemDetail />} />
            <Route path="/attempts/:attemptId" element={<AttemptWorkspace />} />
            <Route path="/submissions/:submissionId" element={<EvaluationResult />} />
            <Route path="*" element={<ProblemLibrary />} />
          </Routes>
        </main>

        <footer className="platform-footer">
          <div className="footer-inner">
            <p>
              CipherSchools Full Stack LLD Practice Platform &bull; Built with React, TypeScript, Express, Prisma &amp; PostgreSQL
            </p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
