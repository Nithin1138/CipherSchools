# AI Usage & Engineering Decisions

In accordance with the assignment brief, this document outlines 5 meaningful engineering decisions where AI assistance was utilized, critically evaluated, and either accepted, rejected, or modified using senior engineering judgment.

---

### Decision 1: Monolithic Architecture vs. Microservices

- **What AI Suggested**:
  Early architecture suggestions proposed splitting the system into separate microservices: an `AttemptService`, an `EvaluationService`, an asynchronous event broker, and a dedicated database per service.
- **What Was Accepted / Rejected**:
  **Rejected.** The assignment explicitly evaluates Low-Level Design (domain modeling, class relationships, and object responsibilities), not complex distributed systems.
- **Why**:
  Introducing microservices would have added distributed transaction overhead, network latency, serialization boundaries, and deployment friction without any tangible pedagogical benefit for a prototype with 4 problems.
- **What We Implemented Instead**:
  A clean, modular monolith with distinct domain, service, and controller layers, unified under an Express/TypeScript backend backed by PostgreSQL.

---

### Decision 2: Arbitrary "Score out of 100" vs. Structured Rubric Scoring

- **What AI Suggested**:
  An initial prompt suggested asking the LLM: *"Grade this design out of 100 and summarize why."*
- **What Was Accepted / Rejected**:
  **Rejected.**
- **Why**:
  Unconstrained LLM scoring produces non-reproducible, arbitrary numbers (e.g., 78 one run, 86 the next) without clear justification. It also hallucinates total scores that do not correlate with specific architectural dimensions.
- **What Was Modified & Implemented**:
  We designed a formal, database-backed 7-dimension evaluation rubric totaling 100 points. The LLM is constrained to output structured per-criterion scores, direct quotes of evidence from the student's submission, specific architectural concerns, and actionable suggestions. The backend—not the LLM—deterministically calculates the total score by summing criterion scores.

---

### Decision 3: Submission 1:N Evaluation vs. Strict 1:1 Cardinality with In-Place Retries

- **What AI Suggested**:
  Allowing `Submission 1 : N Evaluation` so that whenever an evaluation fails or is retried, the system simply creates a new `Evaluation` record.
- **What Was Accepted / Rejected**:
  **Rejected** after architectural review.
- **Why**:
  In a practice workflow, one specific submitted design has exactly one definitive evaluation. Creating multiple evaluation rows creates ambiguity over which evaluation is current, clutters historical views, and risks multiple evaluation records being created concurrently for the same submission.
- **What Was Modified & Implemented**:
  Enforced strict `1 : 1` cardinality with a database-level unique constraint (`UNIQUE(submission_id)`). If an evaluation fails (e.g. LLM timeout), the existing record transitions to `FAILED`. A retry updates the same record in-place (`FAILED → EVALUATING → COMPLETED`). If the student wants to modify their design, they start a new `Attempt`, creating a new `Submission` and `Evaluation`.

---

### Decision 4: Evaluator Interface Abstraction (Change Test B)

- **What AI Suggested**:
  Hardcoding the OpenAI or Gemini SDK directly into the Express route handler or `EvaluationService`.
- **What Was Accepted / Rejected**:
  **Rejected the direct coupling; accepted the Evaluator interface pattern.**
- **Why**:
  Tying the domain practice loop directly to a third-party LLM provider violates the Dependency Inversion Principle and fails **Change Test B** (adding rule-based or human evaluators in the future).
- **What Was Modified & Implemented**:
  Created an `Evaluator` interface:
  ```typescript
  export interface Evaluator {
    readonly name: string;
    evaluate(input: EvaluationInput): Promise<EvaluationResult>;
  }
  ```
  `LLMEvaluator` implements this contract. The service layer interacts solely with the abstraction. We added a deterministic `MockLLMProvider` so the evaluation pipeline can be tested offline without external API calls.

---

### Decision 5: Direct LLM JSON Trust vs. Strict Zod Schema & Evidence Grounding

- **What AI Suggested**:
  Relying on basic `JSON.parse(llmOutput)` and persisting the payload directly, trusting the LLM to compute the `totalScore`, match criterion IDs, and validate that its cited evidence is accurate.
- **What Was Accepted / Rejected**:
  **Rejected direct trust; implemented multi-stage runtime validation.**
- **Why**:
  LLMs frequently suffer from arithmetic hallucination (e.g., criterion sub-scores sum to 81, but the LLM states `totalScore: 89`), criterion omission or duplication, and evidence fabrication (quoting concepts or patterns the candidate never mentioned, or providing vague generic feedback like "Looks good").
- **What Was Modified & Implemented**:
  We built a dedicated `OutputValidator` powered by Zod and an evidence-grounding engine:
  1. **Schema Validation**: Validates the presence of all 7 rubric criteria, enforces numerical ranges ($0 \le \text{score} \le \text{maxScore}$), and rejects unknown or duplicate criterion IDs.
  2. **Evidence Grounding Verification**: Enforces that each criterion's cited evidence either directly quotes phrases/tokens present in the candidate's submission text or explicitly documents an omission (using markers such as `"not specified"`, `"missing"`, or `"does not mention"`). Rejects generic placeholders and fabricated quotes.
  3. **Deterministic Aggregation**: Ignores any LLM-reported `totalScore` and deterministically computes `totalScore = sum(criterionScores)` on the backend.
