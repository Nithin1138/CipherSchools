# LLM Evaluator Architecture

## 1. Overview & Core Abstractions

The LLM Evaluator subsystem implements an enterprise-grade, rubric-driven, and vendor-agnostic evaluation engine for Low-Level Design (LLD) submissions. It decouples the core domain workflow and database persistence from specific model SDKs or external APIs.

```
REST API Controller
        ↓
EvaluationService (State Machine & Persistence)
        ↓
Evaluator Interface
        ↓
LLMEvaluator
        ├── PromptBuilder (Structured, anti-hallucination prompt generator)
        ├── LLMProvider Interface (Network abstraction & timeout management)
        │     ├── GeminiProvider (Google Gemini API: configurable via GEMINI_MODEL, default: gemini-2.0-flash)
        │     ├── OpenAIProvider (OpenAI Chat Completions API, default: gpt-4o-mini)
        │     └── MockLLMProvider (Deterministic offline testing mock)
        └── OutputValidator (Zod schema + rubric boundary assertions + evidence grounding)
        ↓
Deterministic Score Aggregator (totalScore = sum(criterion.score))
        ↓
PostgreSQL Persistence (Prisma transaction: Feedback[] + Evaluation status)
```

---

## 2. Component Design

### 2.1 The `Evaluator` Domain Contract
Defined in [`backend/src/domain/evaluator.ts`](../backend/src/domain/evaluator.ts):
```typescript
export interface Evaluator {
  readonly name: string;
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
```
This abstraction isolates the practice and grading flow from evaluator implementations (satisfying **Change Test B**: substituting or augmenting LLM evaluation with rule-based checkers or human review requires zero changes to the service layer).

### 2.2 Provider Abstraction (`LLMProvider`)
Defined in [`backend/src/evaluators/providers/provider.interface.ts`](../backend/src/evaluators/providers/provider.interface.ts):
```typescript
export interface LLMProvider {
  readonly name: string;
  readonly modelName: string;
  generateStructuredResponse(prompt: PromptPayload, options?: ProviderOptions): Promise<string>;
}
```
- **`GeminiProvider`**: Connects to Google Gemini API (`generateContent`) using native HTTP `fetch` and structured `responseMimeType: "application/json"`. Configurable via `GEMINI_MODEL` (defaults to `gemini-2.0-flash`).
- **`OpenAIProvider`**: Connects to OpenAI Chat Completions API using `response_format: { type: "json_object" }` (defaults to `gpt-4o-mini`).
- **`MockLLMProvider`**: Provides programmable responses, timeout simulations, and failure injections for automated testing without consuming external tokens or requiring internet access.

---

## 3. Prompt Architecture & Anti-Hallucination Rules

Prompt construction is isolated in [`backend/src/evaluators/prompt.builder.ts`](../backend/src/evaluators/prompt.builder.ts) with strict sections:

1. **System Instructions**:
   - **Evaluate Design, Not Candidate**: Focus purely on technical merits and deficiencies in submitted code/text.
   - **Anti-Hallucination Rule**: Never assume unmentioned patterns, persistence, or concurrency exist (e.g., if database storage is unmentioned, state: *"The submission does not specify persistence"* rather than guessing).
   - **Distinguish Omission vs. Flaw**: Differentiate between unspecified details and fundamentally broken designs.
   - **Evidence-First Feedback**: Require direct citations or quotations from the candidate's submission.
2. **Problem Context**: Problem title, full problem statement, explicit functional requirements, and system constraints.
3. **Active Rubric Criteria**: Dynamically loaded from PostgreSQL (never hardcoded), specifying criterion ID, name, description, and maximum score.
4. **Candidate Submission**: Verbatim candidate response.
5. **Output Schema Specification**: Demands a clean JSON response adhering to criterion IDs and numeric bounds.

---

## 4. Structured Output & Evidence Grounding Validation

The model must respond with a strictly typed JSON shape:
```json
{
  "criteria": [
    {
      "criterionId": "uuid-or-id",
      "criterionName": "Requirements Completeness",
      "score": 18,
      "evidence": "Candidate wrote: 'ParkingLot coordinates floors while TicketManager handles ticket issuance.'",
      "concern": "ParkingLot could become bloated if fee calculation logic is added directly.",
      "suggestion": "Extract fee calculation into an independent FeeCalculationStrategy.",
      "confidence": 0.95
    }
  ]
}
```

Validation is executed by [`backend/src/evaluators/validator.ts`](../backend/src/evaluators/validator.ts) before any data touches the database:
- **JSON Sanitization**: Strips markdown code wrappers (````json ... ````).
- **Zod Schema Parsing**: Enforces field types and presence.
- **Rubric Completeness**: Every active rubric criterion must be present in the response (no missing criteria).
- **Rubric Integrity**: Rejects duplicate criterion IDs or unrecognized criterion IDs.
- **Score Bounds**: Strictly enforces `0 <= score <= criterion.maxScore`.
- **Confidence Bounds**: Strictly enforces `0.0 <= confidence <= 1.0`.
- **Evidence Grounding Engine (`isEvidenceGrounded`)**:
  - **Verbatim Quotations**: Checks that quoted snippets/phrases are directly present in candidate submission text.
  - **Explicit Omission Markers**: If the candidate omitted a requirement, evidence must explicitly state so (e.g., *"not specified"*, *"missing"*, *"does not mention"*, *"unspecified"*).
  - **Placeholder & Fabrication Rejection**: Vague generic text (e.g., *"Evaluated submission."*, *"Looks good."*) and fabricated citations are strictly rejected with an `OutputValidationError`.

If validation fails, an `OutputValidationError` is thrown, triggering the evaluation failure workflow.

---

## 5. Deterministic Scoring & Atomic Persistence

To prevent LLM hallucination and mathematical inconsistencies:
1. The model is **never** asked for a total score. It only scores individual criteria.
2. The application calculates:
   $$\text{totalScore} = \sum_{i=1}^{N} \text{criterion}_i\text{.score}$$
   $$\text{maxScore} = \sum_{i=1}^{N} \text{criterion}_i\text{.maxScore}$$
3. All criterion feedbacks and the completed evaluation state are committed inside an atomic Prisma transaction (`prisma.$transaction`).

---

## 6. Execution Flow: Current Synchronous Evaluation vs. Future Queues

- **Current Implementation (Synchronous Orchestration)**:
  `POST /api/submissions/:submissionId/evaluation` orchestrates evaluation immediately on the server request thread:
  1. Creates/verifies `Evaluation` in status `EVALUATING` inside a transaction.
  2. Dispatches prompt to configured evaluator (`LLMEvaluator`).
  3. Validates output and grounded evidence.
  4. Commits `COMPLETED` state and score inside a database transaction.
  5. Returns HTTP 201 with completed evaluation data.
  6. Includes concurrent lock protection: if duplicate evaluation requests arrive simultaneously for the same submission, only one executes evaluation while the other safely returns the current state without duplicate execution.

- **Future Work (Asynchronous Message Queue)**:
  For high-scale production with thousands of concurrent evaluations:
  - Transition to Redis BullMQ / Amazon SQS message queues.
  - Webhook or Server-Sent Events (SSE) notification to frontend.
  - Current database state machine (`PENDING → EVALUATING → COMPLETED | FAILED`) is already fully designed and ready for worker decoupling without database schema migrations.

---

## 7. Failure Handling, Timeouts & In-Place Retry

### 7.1 Save-Before-Evaluate Guarantee
The `Evaluation` record is initialized in the database (`PENDING → EVALUATING`) **before** dispatching the request to the LLM. If the provider fails, times out, or returns malformed output:
- The `Evaluation` record is marked `FAILED` with the exact error context (`errorMessage`).
- The candidate's `Submission` remains 100% intact and undamaged.

### 7.2 Timeouts
- Requests employ `AbortController` with a default 30-second timeout (`timeoutMs: 30000`).
- On timeout, the request aborts and records a clear timeout failure.

### 7.3 In-Place Retry
When a learner or client requests a retry on a failed evaluation:
- State transition: `FAILED → EVALUATING → COMPLETED`.
- Updates the **existing** `Evaluation` record.
- Preserves the strict 1:1 `Submission → Evaluation` database constraint without creating duplicate rows.

---

## 8. Security Rules

- **Backend-Only Credentials**: API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are read strictly from backend environment variables and are never bundled, referenced, or exposed in frontend code.
- **Redacted Logging**: Evaluation start, duration, and error messages are logged for operational observability. Raw API keys, authorization headers, and sensitive auth data are never logged.
- **Client Sanitization**: API responses return structured criterion feedback without leaking model vendor tokens, request headers, or internal trace dumps.

---

## 9. Environment Configuration

To configure the LLM Evaluator locally, define the following in `backend/.env`:

```env
# Server & Database
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lld_practice?schema=public"

# Primary Provider: Google Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash

# Alternative Provider: OpenAI
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4o-mini
```

*(Note: Automated vitest test suites run completely offline using `MockLLMProvider` by default, requiring zero API keys or network calls).*
