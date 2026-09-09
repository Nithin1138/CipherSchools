import React from 'react';
import { Link } from 'react-router-dom';

interface ErrorStateProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something Went Wrong',
  message,
  code,
  onRetry,
  showHomeLink = true,
}) => {
  return (
    <div className="error-state-card" role="alert">
      <div className="error-icon-badge">!</div>
      <h3 className="error-title">{title}</h3>
      {code && <span className="error-code-badge">{code}</span>}
      <p className="error-description">{message}</p>

      <div className="error-actions">
        {onRetry && (
          <button type="button" className="btn-primary" onClick={onRetry}>
            Retry Action
          </button>
        )}
        {showHomeLink && (
          <Link to="/" className="btn-secondary">
            Return to Problem Library
          </Link>
        )}
      </div>
    </div>
  );
};
