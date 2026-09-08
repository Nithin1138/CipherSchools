import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { problemRoutes } from './routes/problems.js';
import { attemptRoutes } from './routes/attempts.js';
import { submissionRoutes } from './routes/submissions.js';
import { evaluationRoutes } from './routes/evaluations.js';
import { rubricRoutes } from './routes/rubric.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Domain API Routes
app.use('/api/problems', problemRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/rubric', rubricRoutes);

// Centralized error handling (must be last middleware)
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
