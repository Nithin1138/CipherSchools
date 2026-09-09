import React from 'react';

interface LoadingStateProps {
  message?: string;
  description?: string;
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  description,
  fullScreen = false,
}) => {
  return (
    <div className={`loading-state-container ${fullScreen ? 'fullscreen' : ''}`} role="status" aria-live="polite">
      <div className="spinner-ring" />
      <h3 className="loading-message">{message}</h3>
      {description && <p className="loading-description">{description}</p>}
    </div>
  );
};
