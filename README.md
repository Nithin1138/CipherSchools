# LLD Practice Platform

A focused, rubric-driven Low-Level Design (LLD) practice workbench that evaluates candidate object-oriented software architectures using structured AI analysis and deterministic scoring.

---

## Problem

Software engineers preparing for Low-Level Design (LLD) interviews face a critical gap: unlike algorithmic coding (which offers instant automated judge feedback like LeetCode) or high-level system design (which focuses on macro architectural topologies), LLD requires evaluating class responsibilities, SOLID principles, design patterns, concurrency safety, and encapsulation. Existing preparation is passive (reading blog posts) or relies on subjective, non-repeatable feedback. 

This platform solves this by providing interactive practice with an evidence-first, rubric-grounded evaluation engine that quotes candidate text, flags architectural vulnerabilities, and suggests concrete improvements.

---

## Product Flow

```
Problem Library ──► Problem Details ──► Start Attempt ──► LLD Workspace ──► Submit ──► Evaluating ──► Evaluation Result ──► Try Again
```

1. **Problem**: Learner reviews functional requirements, constraints, and the standard 100-point rubric.
2. **Attempt**: Learner starts an attempt (`status: IN_PROGRESS`), opening the split-pane workspace.
3. **Submission**: Learner writes an LLD solution in Markdown (persisted to local draft) and submits.
4. **Evaluation**: Solution is committed to PostgreSQL before triggering automated evaluation (save-before-evaluate guarantee).
5. **Feedback**: System validates LLM structured output, calculates deterministic scores, and renders evidence-backed feedback across 7 rubric dimensions.
6. **Try Again**: Learner iterates by launching a fresh attempt while preserving previous attempts and scores in history.

---

## Key Engineering Decisions

- **Service Layer Pattern**: Thin REST controllers only parse HTTP parameters and delegate to domain services. Business rules and state transitions remain strictly decoupled from Express.
- **Evaluator Abstraction (`Evaluator` Interface)**: The core grading workflow interacts with an `Evaluator` interface rather than directly binding to specific LLM vendor SDKs. This allows plugging in Gemini, OpenAI, rule-based heuristics, or human grading with zero changes to service logic.
- **Structured LLM Output & Strict Validation**: The LLM must output clean JSON matching a strict Zod schema. The backend asserts that all 7 active rubric criteria are present, rejects unknown or duplicate criteria, enforces $[0, \text{maxScore}]$ bounds, and strips markdown wrappers.
- **Deterministic Scoring**: The model is **never** permitted to calculate the total score. The backend derives $\text{totalScore} = \sum \text{criterionScores}$. This prevents hallucinated math and maintains mathematical consistency.
- **Evaluation State Machine & Synchronous Execution**: Evaluations follow explicit states (`PENDING` $\rightarrow$ `EVALUATING` $\rightarrow$ `COMPLETED` / `FAILED`). The state machine is architecturally designed to support asynchronous background execution (e.g. BullMQ/Redis), while the current MVP executes evaluation synchronously within the evaluation request and persists intermediate states to PostgreSQL for transparent failure and in-place retry handling. Completed evaluations are immutable.
- **Learner Retry vs Evaluation Retry**:
  - **Learner Retry ("Try Again")**: Creates a brand new `Attempt` record, leaving prior attempts and evaluations completely intact in the historical timeline.
  - **Evaluation Retry**: Used exclusively for transient model/network failures; transitions `FAILED` $\rightarrow$ `EVALUATING` in-place on the same `Evaluation` row and re-executes grading without duplicating database records.
- **Relational Integrity via PostgreSQL & Prisma**: Strictly enforces 1:1 Attempt-to-Submission and 1:1 Submission-to-Evaluation relationships via database-level `UNIQUE` constraints and foreign keys.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, React Router v7, Vite 8, Vanilla CSS (Dark Workbench design system).
- **Backend**: Node.js, Express 5, TypeScript, Zod.
- **Database**: PostgreSQL with Prisma ORM.
- **AI / Evaluation**: Google Gemini (`gemini-3.6-flash`) via structured `Evaluator` abstraction; offline `MockLLMProvider` for deterministic testing.
- **Testing**: Vitest integration and domain test suite.

---

## Project Structure

```
CipherSchools/
├── README.md                      # Project overview, setup, and architecture summary
├── RESEARCH_NOTE.md               # Research note: learner problem, market analysis, identified gaps
├── DESIGN_NOTE.md                 # System architecture & low-level design document
├── AI_USAGE.md                    # Transparent audit of AI-assisted engineering decisions
├── docs/
│   ├── ARCHITECTURE.md            # Deep system architecture & sequence diagrams
│   ├── API.md                     # REST API specification & schemas
│   └── LLM-EVALUATOR.md           # Prompt engineering, validation & retry architecture
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Relational models (Problem, Attempt, Submission, Evaluation, Feedback, Rubric)
│   │   └── seed.ts                # 4 core LLD problems + 100-point rubric
│   ├── src/
│   │   ├── app.ts                 # Express app configuration & middleware
│   │   ├── domain/                # Pure types and Evaluator domain contract
│   │   ├── evaluators/            # LLMEvaluator, PromptBuilder, OutputValidator, Providers
│   │   ├── services/              # Domain logic (Attempt, Submission, Evaluation, Problem, Rubric)
│   │   ├── controllers/           # HTTP controllers
│   │   └── routes/                # Express router mounts
│   └── tests/                     # 5 test suites (domain, api, flow, llm, problems)
└── frontend/
    ├── src/
    │   ├── api/                   # API client bindings
    │   ├── components/            # UI components (ProblemCard, ScoreDisplay, FeedbackCard, AttemptHistory)
    │   ├── pages/                 # ProblemLibrary, ProblemDetail, AttemptWorkspace, EvaluationResult
    │   ├── types/                 # Frontend TypeScript interfaces
    │   └── App.tsx                # Client-side router & navbar
    └── vite.config.ts             # Dev proxy configuration (:3001)
```

---

## Local Setup

### Prerequisites
- **Node.js**: v20+ or v22+
- **PostgreSQL**: v14+ running locally (default port: `5432`)

### 1. Database Setup
Create the database:
```bash
createdb lld_practice
# or: psql -U postgres -c "CREATE DATABASE lld_practice;"
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```

Configure `backend/.env` with your PostgreSQL connection and Gemini API key:
```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lld_practice?schema=public"
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
```

Run database migrations and seed the 4 core problems:
```bash
npx prisma migrate dev
npm run db:seed
```

Start the backend server:
```bash
npm run dev
```
The API server starts on `http://localhost:3001`. Verify with `curl http://localhost:3001/api/health`.

### 3. Frontend Setup
In a second terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Environment Variables

| Variable | Required | Description | Default / Example |
|---|---|---|---|
| `PORT` | No | Backend HTTP port | `3001` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/lld_practice` |
| `LLM_PROVIDER` | No | Active evaluation provider (`gemini`, `openai`, `mock`) | `gemini` |
| `GEMINI_API_KEY` | Conditional | Google Gemini API key (required for live Gemini evaluations) | `AIzaSy...` |
| `GEMINI_MODEL` | No | Gemini model identifier | `gemini-3.6-flash` |
| `OPENAI_API_KEY` | Conditional | OpenAI API key (if using OpenAI provider) | `sk-...` |
| `VITE_API_BASE_URL` | No | Optional custom API origin for frontend production | `/api` |

---

## API Reference

Complete endpoint specifications, request payloads, and status codes are documented in [`docs/API.md`](./docs/API.md).

Key endpoints:
- `GET /api/problems`: List all curated problems
- `GET /api/problems/:id`: Problem specifications, requirements, and constraints
- `GET /api/problems/:id/attempts`: Past attempt history for the problem
- `POST /api/problems/:id/attempts`: Start a fresh attempt
- `POST /api/attempts/:id/submission`: Submit solution content
- `POST /api/submissions/:id/evaluation`: Trigger evaluation
- `GET /api/evaluations/:id`: Retrieve evaluation score and 7-dimension feedback
- `POST /api/evaluations/:id/retry`: In-place retry for failed evaluations

---

## Evaluation Architecture

For deep architectural details on the evaluation engine, prompt engineering, anti-hallucination rules, and validation checks, see [`docs/LLM-EVALUATOR.md`](./docs/LLM-EVALUATOR.md).

---

## Testing

The platform features an automated Vitest test suite that runs 100% offline using `MockLLMProvider`:

```bash
cd backend
npm test
```

### Verified Test Results:
```
 ✓ tests/llm.evaluator.test.ts   (14 tests)
 ✓ tests/learner.flow.test.ts     (8 tests)
 ✓ tests/domain.test.ts          (11 tests)
 ✓ tests/api.test.ts             (15 tests)
 ✓ tests/problems.audit.test.ts   (6 tests)

 Test Files  5 passed (5)
      Tests  54 passed (54)
   Duration  407ms
```

To run TypeScript verification:
```bash
cd backend && npx tsc --noEmit
cd frontend && npm run build
```

---

## Limitations & Future Improvements

- **Single-File Markdown Submissions**: Solutions are currently submitted as a single Markdown document containing entity models, design patterns, and code snippets. A future version could support multi-file tabbed IDE editors.
- **Asynchronous Message Queue**: For extreme traffic spikes, moving from HTTP polling to a Redis/BullMQ background worker queue would decouple evaluation execution from HTTP request threads.
- **Diagram Rendering**: While candidates can provide ASCII or Mermaid text in Markdown, interactive visual UML class diagramming (e.g. drag-and-drop relationship canvas) would enhance visual learning.
- **Automated Rubric Calibration**: Adding a calibration benchmark suite with synthetic human-graded submissions to continuously measure evaluator scoring variance across model versions.
