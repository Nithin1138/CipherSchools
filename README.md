# LLD Practice Platform

A focused, rubric-driven Low-Level Design practice platform built as a 2-day engineering assignment for the Full Stack Development internship at CipherSchools.

---

## 1. Product Overview

The **LLD Practice Platform** enables software engineering learners to practice Low-Level Design through a repeatable, evidence-backed learning loop:

1. **Select a Problem**: Choose from 4 curated LLD challenges (Parking Lot, Elevator System, Vending Machine, Food Delivery).
2. **Review Requirements & Rubric**: Inspect clear functional requirements, constraints, and the standard 100-point evaluation rubric.
3. **Draft Design**: Structure classes, responsibilities, relationships, interfaces, and trade-offs in a split-screen markdown editor.
4. **Submit for Evaluation**: Designs are persisted before evaluation begins (save-before-evaluate guarantee).
5. **Receive Explainable Feedback**: The Rubric Evaluator scores each dimension with direct quotes of evidence from the design, specific architectural concerns, and actionable suggestions.
6. **Iterate & Improve**: Click "Try Again" to launch a new attempt, preserving historical attempts to track design evolution.

---

## 2. Architecture & Tech Stack

```text
  ┌──────────────────────────────────────────────┐
  │              React (TypeScript)              │
  │     Vite • Split-Screen Editor • CSS         │
  └──────────────────────┬───────────────────────┘
                         │ REST API (Vite proxy /api)
                         ▼
  ┌──────────────────────────────────────────────┐
  │             Express (TypeScript)             │
  │  Routes ──► Controllers ──► Services         │
  │                       │                      │
  │                       ▼                      │
  │                  Evaluator (interface)       │
  │                       │                      │
  │                  LLMEvaluator                │
  │          (OpenAI / Gemini / Heuristic)       │
  └──────────────────────┬───────────────────────┘
                         │ Prisma ORM
                         ▼
  ┌──────────────────────────────────────────────┐
  │                  PostgreSQL                  │
  │  Problems • Attempts • Submissions           │
  │  Evaluations • Feedback • Rubrics            │
  └──────────────────────────────────────────────┘
```

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS
- **Backend**: Node.js, Express, TypeScript, Zod
- **Database**: PostgreSQL with Prisma ORM
- **Evaluation Engine**: Provider-agnostic `Evaluator` abstraction supporting OpenAI (`gpt-4o-mini`), Google Gemini (`gemini-1.5-flash`), or local heuristic evaluation
- **Testing**: Vitest integration and domain suite

---

## 3. Project Structure

```
CipherSchools/
├── README.md                                  # Setup, architecture, run guide
├── DESIGN.md                                  # Full LLD system design, state machines, change tests
├── RESEARCH.md                                # Learner problem, existing tools, market gap
├── AI_USAGE.md                                # 4 meaningful AI-assisted decisions
├── CipherSchools-Hiring-Assignment-SEP'2026.md # Official assignment brief
├── plan.md                                    # Source of truth (Research Note & execution plan)
│
├── backend/
│   ├── src/
│   │   ├── app.ts                             # Express app entry & route mounting
│   │   ├── domain/
│   │   │   ├── types.ts                       # Enums & domain data structures
│   │   │   └── evaluator.ts                   # Evaluator interface (Change Test B)
│   │   ├── services/
│   │   │   ├── problem.service.ts
│   │   │   ├── attempt.service.ts
│   │   │   ├── submission.service.ts
│   │   │   ├── evaluation.service.ts          # Save-before-evaluate & in-place retry
│   │   │   └── rubric.service.ts
│   │   ├── controllers/                       # Thin HTTP controllers
│   │   ├── evaluators/
│   │   │   └── llm.evaluator.ts               # Structured LLM evaluator
│   │   ├── middleware/
│   │   │   └── errorHandler.ts                # AppError + centralized handler
│   │   ├── routes/                            # Modular Express routers
│   │   └── lib/
│   │       └── prisma.ts                      # Prisma client singleton
│   ├── prisma/
│   │   ├── schema.prisma                      # 7-entity relational schema
│   │   ├── migrations/                        # SQL migration history
│   │   └── seed.ts                            # 4 problems + 7 rubric criteria
│   ├── tests/
│   │   └── domain.test.ts                     # Vitest test suite (9 tests)
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── App.tsx                            # Main application shell & navigation
    │   ├── App.css                            # Clean, responsive styles
    │   ├── api/
    │   │   └── client.ts                      # Typed REST API client
    │   ├── components/
    │   │   ├── ProblemList.tsx                # Problem selection grid
    │   │   ├── ProblemDetail.tsx              # Requirements, rubric, history tabs
    │   │   ├── DesignEditor.tsx               # Split-view design editor
    │   │   └── EvaluationView.tsx             # Score breakdown, evidence quotes, retry
    │   └── types/
    │       └── index.ts                       # Frontend TypeScript definitions
    ├── vite.config.ts                         # Vite config with backend proxy (:3001)
    └── package.json
```

---

## 4. Getting Started

### Prerequisites
- **Node.js**: v20+ or v22+
- **PostgreSQL**: v14+ running locally (default: port 5432)

### 1. Database Setup
Ensure PostgreSQL is running, then create the database:
```bash
createdb lld_practice
```
*(Or use `psql -c "CREATE DATABASE lld_practice;"`)*

Configure your connection string in `backend/.env` (defaults to `postgres:postgres@localhost:5432/lld_practice`).

### 2. Configure AI Evaluator (Google Gemini API)
The platform uses **Google Gemini** for intelligent, rubric-based evaluation.

In `backend/.env`:
```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

> **Note**: If `GEMINI_API_KEY` is not provided or remains a placeholder, the platform automatically engages its built-in **domain heuristic evaluation engine**, analyzing entity modeling, design patterns, edge cases, and interfaces so candidate workflows never crash in offline or test environments.

### 3. Backend Setup & Seeding
```bash
cd backend
npm install
npx prisma migrate dev
npm run db:seed
```
This applies the migration and seeds:
- 4 Core Problems: **Parking Lot**, **Elevator System**, **Vending Machine**, **Food Delivery**
- Standard 100-point LLD Rubric across 7 weighted dimensions

Start the backend server:
```bash
npm run dev
```
The backend starts on `http://localhost:3001`. Verify with:
```bash
curl http://localhost:3001/api/health
# {"status":"ok"}
```

### 4. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. The frontend proxy automatically routes `/api` calls to `:3001`.

---

## 5. Running Automated Tests

Run the domain and integration test suite:
```bash
cd backend
npm test
```
**Tests cover:**
- Problem retrieval & attempt lifecycle
- Preserving historical attempts (Attempt 1 vs Attempt 2)
- Submission validation & empty rejection guards
- 1:1 Attempt to Submission constraint
- Save-before-evaluate guarantee
- Deterministic score summing ($\sum \text{criterionScores} = \text{totalScore}$)
- Database-level `UNIQUE(submission_id)` constraint
- Evaluation failure transition without losing submission data
- In-place evaluation retry without duplicate records

---

## 6. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/problems` | List all 4 curated LLD problems |
| `GET` | `/api/problems/:id` | Get problem requirements and constraints |
| `GET` | `/api/problems/:id/attempts` | Get past attempt history for a problem |
| `GET` | `/api/rubric` | Get the default 7-criteria evaluation rubric |
| `POST` | `/api/attempts` | Start a new attempt (`{ problemId }`) |
| `GET` | `/api/attempts/:id` | Get attempt details with submission & evaluation |
| `POST` | `/api/submissions` | Submit a design (`{ attemptId, content, type }`) |
| `GET` | `/api/submissions/:id` | Get submission content |
| `POST` | `/api/submissions/:id/evaluate` | Trigger evaluation (or retry if failed) |
| `GET` | `/api/evaluations/:submissionId` | Get evaluation score and structured feedback |

---

## 7. Assignment Deliverables Checklist

- [x] **Working Prototype**: Full practice flow from problem selection to rubric feedback and attempt history
- [x] **Research Note**: [`RESEARCH.md`](./RESEARCH.md)
- [x] **Design Note**: [`DESIGN.md`](./DESIGN.md)
- [x] **AI Decisions Log**: [`AI_USAGE.md`](./AI_USAGE.md)
- [x] **Automated Tests**: [`backend/tests/domain.test.ts`](./backend/tests/domain.test.ts) (9 passing tests)
- [x] **4 Curated LLD Problems**: Seeded with real requirements, constraints, and assumptions
- [x] **Clean Monolith**: No unnecessary microservices, Redis, or Kafka dependencies
