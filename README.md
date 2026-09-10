# CipherSchools — Low-Level Design (LLD) Practice Platform

An interactive, deliberate-practice platform for mastering Low-Level Design (LLD) and Object-Oriented Design (OOD). Built for the **CipherSchools Hiring Assignment (September 2026)**.

---

## The Learner Problem Solved

Unlike algorithmic challenges where automated test cases yield clear Pass/Fail signals, Low-Level Design is notoriously difficult to self-evaluate. Candidates sketch classes and design patterns but have no objective way of knowing whether they created god-objects, coupled interfaces prematurely, or neglected critical concurrency edge cases. Generic chatbots offer superficial, uncalibrated praise without structured rubrics or evidence grounding.

This platform bridges that gap by providing:
1. **Curated Problem Library**: 4 real-world systems with explicit requirements and constraints (Parking Lot, Elevator System, Vending Machine, Food Delivery App).
2. **Standardized 100-Point Rubric**: Evaluates solutions across 7 architectural dimensions dynamically served from the database.
3. **Evidence-Grounded Feedback**: Every score is backed by verbatim quotations from the student's submission, concrete concerns, actionable suggestions, and confidence ratings.
4. **Save-Before-Evaluate Reliability**: Submissions are committed to PostgreSQL *before* calling the evaluator, guaranteeing student work is never lost on network or model failures.
5. **Measurable Improvement Loop**: Attempts are immutable records. When learners retry, previous attempts are preserved, and score trajectory badges (`+15 pts`, `-5 pts`, `Baseline`) highlight progress.

---

## Architectural Highlights

- **Relational Integrity via PostgreSQL & Prisma**: Strictly enforces 1:1 Attempt-to-Submission and 1:1 Submission-to-Evaluation relationships via database-level `UNIQUE` constraints and foreign keys.
- **Save-Before-Evaluate Guarantee**: Submissions are durably stored in PostgreSQL before the evaluation begins. If the evaluator fails, the submission is never lost and evaluation can be retried in-place.
- **Vendor-Agnostic Evaluator Abstraction**: Implements an `Evaluator` domain contract supporting `GeminiProvider` (`gemini-2.0-flash`), `OpenAIProvider` (`gpt-4o-mini`), and `MockLLMProvider` (for deterministic offline testing).
- **Zod Output Validation & Grounding Engine**: Rejects hallucinated criteria, ungrounded placeholder evidence, duplicate keys, and arithmetic errors. Deterministically computes total scores on the server.
- **Concurrent Safe Execution**: Server-level concurrency control prevents race conditions on duplicate evaluation requests.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, React Router v7, Vite 8, Vitest, Testing Library, Vanilla CSS (Dark Workbench design system).
- **Backend**: Node.js, Express 4, TypeScript, Prisma ORM, Zod, Vitest.
- **Database**: PostgreSQL (Prisma Client).
- **AI / Evaluation**: Google Gemini (configurable via `GEMINI_MODEL`, default: `gemini-2.0-flash`) via structured `Evaluator` abstraction; OpenAI (`gpt-4o-mini`); offline `MockLLMProvider` for deterministic testing.
- **Testing**: 70 automated tests (61 backend unit/domain/api tests + 9 frontend component/flow tests).

---

## Directory & Command Map

Every command in this repository must be executed from its specific directory:

| Directory | Purpose | Allowed Commands |
|---|---|---|
| `backend/` | Express API, Prisma ORM, Evaluator services, Domain logic | `npm install`, `npx prisma generate`, `npx prisma migrate dev`, `npm run db:seed`, `npm test`, `npx tsc --noEmit`, `npm run dev` |
| `frontend/` | React single-page application, Dark Workbench UI, Vitest | `npm install`, `npm test`, `npm run build`, `npm run lint`, `npm run dev` |
| Repository Root | Documentation, architectural notes, research briefs | Git operations, viewing documentation |

---

## Local Setup & Clean-Install Guide

### Prerequisites
- **Node.js**: v20+ or v22+
- **PostgreSQL**: v14+ running locally (default port: `5432`)

### 1. Database Setup
Create the database:
```bash
createdb lld_practice
# or using psql:
# psql -U postgres -c "CREATE DATABASE lld_practice;"
```

### 2. Backend Setup
From the repository root:
```bash
cd backend
npm install
cp .env.example .env
```

Configure `backend/.env` with your PostgreSQL connection:
```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lld_practice?schema=public"

# For offline testing or local evaluation without API keys:
LLM_PROVIDER=mock

# For live evaluations with Google Gemini:
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_api_key_here
# GEMINI_MODEL=gemini-2.0-flash

# For live evaluations with OpenAI:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4o-mini
```

Run database migrations, generate Prisma Client, and seed the 4 core problems:
```bash
npx prisma migrate dev
npm run db:seed
```

Run backend automated tests (100% offline with MockLLMProvider):
```bash
npm test
```

Start the backend API server:
```bash
npm run dev
```
The backend starts on `http://localhost:3001`. Verify with `curl http://localhost:3001/api/health`.

### 3. Frontend Setup
In a separate terminal window:
```bash
cd frontend
npm install
npm test
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Reviewer Demo Walkthrough

Follow this step-by-step path to experience the complete practice loop:

1. **Problem Library**: Navigate to `http://localhost:5173`. Browse the 4 curated LLD problems (Parking Lot, Elevator System, Vending Machine, Food Delivery). Note difficulty tags and requirement counts.
2. **Problem Detail**: Click on **"Practice →"** on *Design a Parking Lot*. Read the explicit requirements (spots, vehicle types, ticketing, concurrency) and system constraints.
3. **Start Attempt**: Click **"Start Practice Attempt →"**. Notice the structured starter template with sections for Requirements, Domain Entities, Design Patterns, Sequences, Extensibility, and Edge Cases.
4. **Dynamic Rubric**: Observe the right-hand panel displaying the 7 evaluation dimensions dynamically loaded from the backend (`GET /api/rubric`) totaling 100 points.
5. **Submit Solution**: Write or refine your solution and click **"Submit Design for Evaluation →"**.
6. **Save-Before-Evaluate & Evaluation**: The submission is committed atomically before evaluation begins. The evaluator assesses the solution and renders:
   - Overall score out of 100 (deterministically aggregated).
   - 7 criterion cards with verbatim quotes of evidence, identified architectural concerns, actionable recommendations, and evaluator confidence.
7. **Iterative Refinement (Try Again)**:
   - Click **"Try Again (Start New Attempt) →"**.
   - Attempt #1 is permanently archived.
   - Enter an improved solution (e.g. adding a `PaymentStrategy` or `SpotAllocationStrategy`).
   - Submit again: View the updated Attempt History showing Attempt #1 vs. Attempt #2 with comparative score badges (`+15 pts`).

---

## Environment Variables

| Variable | Directory | Required | Description | Default / Example |
|---|---|---|---|---|
| `PORT` | `backend/` | No | Backend HTTP port | `3001` |
| `DATABASE_URL` | `backend/` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/lld_practice` |
| `LLM_PROVIDER` | `backend/` | No | Evaluation provider (`mock`, `gemini`, `openai`) | `mock` (tests) / `gemini` (live) |
| `GEMINI_API_KEY` | `backend/` | Conditional | Google Gemini API key (required if `LLM_PROVIDER=gemini`) | `AIzaSy...` |
| `GEMINI_MODEL` | `backend/` | No | Gemini model identifier | `gemini-2.0-flash` |
| `OPENAI_API_KEY` | `backend/` | Conditional | OpenAI API key (required if `LLM_PROVIDER=openai`) | `sk-...` |
| `OPENAI_MODEL` | `backend/` | No | OpenAI model identifier | `gpt-4o-mini` |
| `VITE_API_BASE_URL` | `frontend/`| No | Optional API base URL for production proxy | `/api` |

---

## Testing & Quality Verification

All automated tests run completely offline without external network or LLM API calls using `MockLLMProvider`.

### Backend Test Suite (61 tests):
```bash
cd backend && npm test
```
```
 ✓ tests/llm.evaluator.test.ts   (18 tests) - Evidence grounding, prompt builder, retry, sanitization
 ✓ tests/api.test.ts             (18 tests) - REST endpoints, retry, concurrency, rubric consistency
 ✓ tests/domain.test.ts          (11 tests) - Domain constraints, 1:1 invariants, state machine
 ✓ tests/learner.flow.test.ts     (8 tests) - End-to-end learner practice cycle
 ✓ tests/problems.audit.test.ts   (6 tests) - All 4 seeded problems evaluated end-to-end

 Test Files  5 passed (5)
      Tests  61 passed (61)
```

### Frontend Test Suite (9 tests):
```bash
cd frontend && npm test
```
```
 ✓ src/__tests__/frontend.test.tsx (9 tests) - Problem library, error states, attempt history, score display, feedback cards, evaluation state, retry, try-again
```

### TypeScript & Production Build Verification:
```bash
cd backend && npx tsc --noEmit
cd frontend && npm run build
```
Both commands complete with 0 errors and 0 warnings.

---

## Known Limitations & Intentional Trade-Offs

- **No Authentication**: The platform is intentionally structured as an open, focused single-user learner workbench. Excluding user authentication, session cookies, and login flows was a deliberate product decision to focus engineering effort on domain modeling, deterministic evaluation, and iterative feedback quality.
- **Text-First Submissions**: Solutions are submitted as structured Markdown text. While text captures class responsibilities, interfaces, patterns, and trade-offs, interactive drag-and-drop UML drawing is left as future work (see Change Test A).
- **PostgreSQL Dependency**: Relational integrity and atomic transactions rely on PostgreSQL.
- **Synchronous Evaluation Orchestration**: Evaluations are executed synchronously on the backend HTTP thread with concurrency-safe locking. For extreme scale, an asynchronous queue (e.g. BullMQ / Redis) can be adopted without database schema migrations.
- **No Human Reviewer in Prototype**: While the system currently routes to `LLMEvaluator`, the `Evaluator` interface is completely decoupled to support `HumanEvaluator` or `RuleBasedEvaluator` (see Change Test B).

---

## Documentation Links

- [Research Note](./RESEARCH_NOTE.md) — Learner problem, market analysis, observed facts vs. assumptions.
- [Design Note](./DESIGN_NOTE.md) — System architecture, domain invariants, and state machine.
- [AI Usage Note](./AI_USAGE.md) — 5 critical engineering decisions and trade-offs.
- [API Specification](./docs/API.md) — Complete REST endpoint schemas and payload examples.
- [LLM Evaluator Architecture](./docs/LLM-EVALUATOR.md) — Prompt engineering, evidence grounding, and provider abstraction.
