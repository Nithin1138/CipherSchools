Yes. This is the version I would **freeze and execute**. No more adding features unless something is required to fix a failure.

I also checked the current LLD landscape. LLDCanvas currently offers UML editing, Draft Notation, timed practice, 110+ problems, code execution and collaboration, while InstaMock offers AI-powered LLD practice and feedback. That means our product should **not** try to compete by simply adding "LLD questions + AI". Our differentiation is the focused **design submission → rubric evaluation → actionable feedback → retry** loop. ([LLDCanvas][1])

# CipherSchools LLD Practice Platform

## Final Top-Tier Submission Plan

### The one-line product

> **A focused LLD practice platform where learners submit their software design and receive rubric-based, evidence-backed feedback that helps them improve on their next attempt.**

That sentence should drive the entire project.

---

# PHASE 1: Research

**Time: 1.5–2 hours**

Create:

```text
RESEARCH.md
```

### 1. Learner problem

Explain:

```text
LLD is difficult to self-evaluate.

A learner can create:
- classes
- interfaces
- relationships
- design patterns

but still doesn't know:
- whether responsibilities are correct
- whether coupling is too high
- whether the design is extensible
- whether the chosen abstractions actually make sense
```

### 2. Existing approaches

Research a small set:

* LLDCanvas
* InstaMock
* traditional courses/articles
* generic AI assistants

LLDCanvas currently focuses heavily on diagramming, patterns, practice problems, interview mode and code execution. ([LLDCanvas][1])

InstaMock focuses on AI mock interviews, including LLD problems and AI feedback. ([InstaMock][2])

### 3. What they do well

Don't attack competitors.

Example:

```text
LLDCanvas:
Strong visual design workflow and practice environment.

InstaMock:
Strong interview simulation and AI-driven feedback.

Traditional resources:
Strong explanations and reference solutions.
```

### 4. Gap

Our gap:

> The MVP focuses specifically on making the learner's submitted design the central artifact and turning evaluation into structured, evidence-based feedback that supports repeated improvement.

### 5. Product direction

```text
Problem
   ↓
Attempt
   ↓
Design Submission
   ↓
Rubric Evaluation
   ↓
Evidence
   ↓
Feedback
   ↓
Retry
```

**Stop research here.**

Don't spend six hours researching.

---

# PHASE 2: Freeze MVP Scope

**Time: 30 minutes**

## Four problems

Keep:

1. Parking Lot
2. Elevator System
3. Vending Machine
4. Food Delivery

Why these four?

Because they exercise different LLD challenges:

| Problem         | Main challenge                    |
| --------------- | --------------------------------- |
| Parking Lot     | object relationships + allocation |
| Elevator        | state + behavior                  |
| Vending Machine | state + transactions              |
| Food Delivery   | workflows + extensibility         |

We aren't building four separate systems.

They're simply four **problem definitions** consumed by the same practice engine.

---

# PHASE 3: User Flow

The entire application should feel like this:

```text
Home
 ↓
Problems
 ↓
Select problem
 ↓
Read requirements
 ↓
Start attempt
 ↓
Write design
 ↓
Submit
 ↓
Evaluation
 ↓
Feedback
 ↓
Retry
 ↓
History
```

That's the product.

No unnecessary dashboard.

No social feed.

No leaderboard.

No chat.

No course system.

No authentication unless needed for the deployment.

---

# PHASE 4: Submission Model

## MVP

Only:

```text
TEXT SUBMISSION
```

The learner writes:

```text
Requirements
Assumptions
Classes
Responsibilities
Relationships
Design explanation
Trade-offs
```

This is enough to evaluate the design.

### Future extensibility

Our model supports:

```text
Submission
   │
   └── type
       ├── TEXT
       ├── DIAGRAM
       └── CODE
```

But only `TEXT` is implemented.

This is important.

We're demonstrating extensibility **without wasting the assignment on a UML editor**.

---

# PHASE 5: Domain Model

This is the most important technical phase.

## Final domain

```text
Problem
   │
   └── Attempt
          │
          └── Submission
                 │
                 └── Evaluation
                        │
                        └── Feedback
```

Separate concepts:

```text
Rubric
Evaluator
```

So conceptually:

```text
                    ┌──────────┐
                    │  Problem │
                    └────┬─────┘
                         │
                         ↓
                    ┌─────────┐
                    │ Attempt │
                    └────┬────┘
                         │
                         ↓
                  ┌────────────┐
                  │ Submission │
                  └─────┬──────┘
                        │
                        ↓
                 ┌────────────┐
                 │ Evaluation │
                 └──────┬─────┘
                        │
                        ↓
                  ┌──────────┐
                  │ Feedback │
                  └──────────┘

                    ┌────────┐
                    │ Rubric │
                    └───┬────┘
                        │
                        ↓
                   Evaluator
```

---

# PHASE 6: Responsibilities

## Problem

```text
Owns:
- title
- description
- requirements
- difficulty

Responsible for:
Defining the challenge.
```

## Attempt

```text
Owns:
- problem
- status
- timestamps

Responsible for:
Representing one learner's attempt.
```

## Submission

```text
Owns:
- attempt
- type
- content
- timestamp

Responsible for:
Representing learner's submitted design.
```

## Evaluation

```text
Owns:
- submission
- evaluator type
- status
- total score

Responsible for:
Representing evaluation result.
```

## Feedback

```text
Owns:
- criterion
- score
- evidence
- concern
- suggestion
- confidence
```

Responsible for:

> Explaining why a particular score was given and how the learner can improve.

## Rubric

Defines evaluation criteria and weights.

## Evaluator

Defines:

```text
evaluate(submission, problem, rubric)
```

---

# PHASE 7: Fix the Evaluation Cardinality

This was one of the issues identified in the latest critique.

For the MVP:

```text
Submission 1 ───── 1 Evaluation
```

Not:

```text
Submission 1 ───── N Evaluations
```

### Why?

One submitted design gets one final evaluation.

If the learner retries:

```text
Attempt 1
  └── Submission 1
       └── Evaluation 1

Attempt 2
  └── Submission 2
       └── Evaluation 2
```

That's much cleaner.

### Database constraint

`Evaluation.submissionId` should be:

```text
UNIQUE
```

Therefore the database itself prevents duplicate evaluations.

Don't rely only on:

```text
if evaluation exists...
```

in application code.

---

# PHASE 8: State Machine

Final state model:

```text
SUBMITTED
    ↓
EVALUATING
    ↓
COMPLETED
```

Failure:

```text
SUBMITTED
    ↓
EVALUATING
    ↓
FAILED
```

Potential retry:

```text
FAILED
    ↓
EVALUATING
```

---

# PHASE 9: Critical Failure Design

This is one of the strongest parts of the submission.

## Wrong

```text
Submit
 ↓
Call OpenAI
 ↓
Save submission
```

If OpenAI fails:

**the learner's work could disappear.**

## Correct

```text
Submit
 ↓
Validate
 ↓
Save Submission
 ↓
Create Evaluation
 ↓
EVALUATING
 ↓
Call LLM
 ↓
Save result
 ↓
COMPLETED
```

If LLM fails:

```text
Submission = SAFE
Evaluation = FAILED
```

The learner can retry evaluation.

This demonstrates actual engineering judgment.

---

# PHASE 10: Evaluator Abstraction

Create:

```text
Evaluator
```

with:

```text
evaluate(...)
```

Then:

```text
LLMEvaluator implements Evaluator
```

Future:

```text
RuleBasedEvaluator implements Evaluator

HumanEvaluator implements Evaluator
```

The practice flow doesn't change.

It simply receives an evaluator.

```text
PracticeService
      ↓
Evaluator
      ↓
LLMEvaluator
```

That answers **Change Test B**.

---

# PHASE 11: Submission Abstraction

Likewise:

```text
SubmissionContent
       ↑
       │
 ┌─────┼────────┐
 │     │        │
Text Diagram   Code
```

MVP:

```text
TextSubmission
```

Future:

```text
DiagramSubmission
CodeSubmission
```

That answers **Change Test A**.

---

# PHASE 12: Evaluation Rubric

Use:

| Criterion                  |  Weight |
| -------------------------- | ------: |
| Requirement understanding  |      15 |
| Class responsibilities     |      20 |
| Encapsulation & interfaces |      15 |
| Coupling & cohesion        |      15 |
| Abstraction / patterns     |      10 |
| Extensibility              |      15 |
| Edge cases & testability   |      10 |
| **Total**                  | **100** |

This becomes actual data, not hardcoded AI instructions.

---

# PHASE 13: AI Output

Never ask:

> "Give this design a score."

Instead:

```text
Evaluate the submission against the provided rubric.

For every criterion return:

criterion
score
maxScore
evidence
concern
suggestion
confidence
```

Example:

```json
{
  "criterion": "Coupling & Cohesion",
  "score": 11,
  "maxScore": 15,
  "evidence": "ParkingLot directly handles allocation rules...",
  "concern": "Multiple allocation responsibilities are concentrated...",
  "suggestion": "Introduce an allocation strategy...",
  "confidence": 0.91
}
```

This is much more defensible than arbitrary AI scoring.

---

# PHASE 14: Deterministic vs AI

## Backend decides

```text
Submission validity
Attempt status
Database relationships
Duplicate evaluation
Score calculation
State transitions
Persistence
```

## AI decides

```text
Design quality
Responsibilities
Coupling
Cohesion
Abstraction
Extensibility
Trade-offs
Improvement suggestions
```

The total score should preferably be calculated by the backend from criterion scores.

Don't let the LLM randomly produce:

```text
Final score = 87
```

when its individual criteria add up to 83.

---

# PHASE 15: Backend

## Stack

```text
Node.js
Express
TypeScript
PostgreSQL
Prisma
OpenAI API
```

Architecture:

```text
Routes
  ↓
Controllers
  ↓
Services
  ↓
Domain
  ↓
Prisma
  ↓
PostgreSQL
```

Keep it a **modular monolith**.

No microservices.

---

# PHASE 16: API

Only build what we actually need.

### Problems

```text
GET /problems
GET /problems/:id
```

### Attempts

```text
POST /attempts
GET /attempts/:id
```

### Submission

```text
POST /attempts/:id/submission
```

### Evaluation

```text
POST /attempts/:id/evaluate
GET /attempts/:id/evaluation
```

### History

```text
GET /problems/:id/attempts
```

That's enough.

---

# PHASE 17: Frontend

Five screens.

## Home

```text
LLD Practice

Practice → Submit → Improve

[Start Practicing]
```

## Problems

Four cards.

## Practice

```text
Problem
Requirements
↓
Your Design
[Submit]
```

## Feedback

```text
84 / 100

Requirements             14/15
Responsibilities         17/20
Encapsulation            12/15
...

Strengths
...

Concerns
...

Suggestions
...
```

## History

```text
Parking Lot

Attempt 1    68
Attempt 2    76
Attempt 3    84
```

---

# PHASE 18: Make Feedback Actually Useful

This is where the product becomes more than an AI wrapper.

Bad:

> "Your coupling can be improved."

Good:

> **Concern:** `ParkingLot` directly determines allocation rules for every vehicle type.
>
> **Evidence:** The submitted design places allocation decisions inside `ParkingLot`.
>
> **Suggestion:** Extract allocation behavior behind an `AllocationStrategy` interface so the rule can change independently.

The reviewer should be able to see:

```text
Score
 ↓
Evidence
 ↓
Problem
 ↓
Concrete improvement
```

---

# PHASE 19: Retry

After evaluation:

```text
[Try Again]
```

creates a **new Attempt**.

Never overwrite the previous submission.

So:

```text
Attempt 1 → 68
Attempt 2 → 76
Attempt 3 → 84
```

This gives the product its learning loop.

---

# PHASE 20: Testing

Don't test every getter.

Test business behavior.

### Submission

```text
✓ Valid submission accepted
✓ Empty submission rejected
✓ Submission persisted
```

### Evaluation

```text
✓ Evaluation created
✓ Duplicate evaluation rejected
✓ Scores calculated correctly
```

### State

```text
✓ SUBMITTED → EVALUATING
✓ EVALUATING → COMPLETED
✓ EVALUATING → FAILED
```

### Failure

```text
✓ LLM failure doesn't delete submission
✓ Evaluation marked FAILED
✓ Retry possible
```

### Domain

```text
✓ Attempt belongs to correct problem
✓ Evaluation belongs to correct submission
```

---

# PHASE 21: Redis / Kafka

**Do not implement them.**

But mention them in `DESIGN.md`.

Use this:

> At larger evaluation volumes, the evaluation step could be moved to an asynchronous worker model. Redis could be used for short-lived job coordination or caching, while Kafka could publish evaluation-completed events for downstream consumers such as analytics or notifications. These are intentionally outside the MVP because the assignment prioritizes LLD/domain design rather than distributed infrastructure.

This shows you read the CipherSchools job description without violating the assignment's scope.

---

# PHASE 22: Deployment

Deployment is **optional priority**.

Preferred:

```text
One application
+
One database
```

If deployment becomes painful:

**stop.**

Do not waste 4 hours fixing CORS, environment variables and three hosting services just for a URL.

A strong local application with:

* README
* screenshots
* demo video
* tests

is better than a broken production deployment.

---

# PHASE 23: Documentation

Exactly four documents.

```text
README.md
RESEARCH.md
DESIGN.md
AI_USAGE.md
```

## README

```text
What is this?
Features
Architecture
Setup
Environment variables
Testing
Demo
Limitations
```

## RESEARCH

```text
Learner problem
Current practice
Existing platforms
Strengths
Gaps
Product direction
```

## DESIGN

```text
Product scope
User flow
Domain model
State machine
Evaluation architecture
Change Test A
Change Test B
Failure handling
Scaling
Trade-offs
Limitations
```

## AI_USAGE

Document genuine AI-assisted decisions.

Example:

```text
Decision 1
AI suggested microservices.
Rejected because MVP scope does not require them.

Decision 2
AI suggested unrestricted scoring.
Rejected in favor of rubric-based structured evaluation.

Decision 3
AI suggested implementing UML diagrams.
Rejected to keep the prototype focused.

Decision 4
AI suggested evaluator abstraction.
Accepted because it directly addresses evaluator replacement.
```

Don't fake this document. The assignment explicitly wants your own judgment over AI output.

---

# PHASE 24: Git

Use meaningful commits.

```text
chore: initialize project structure

feat: add problem and attempt domain

feat: implement text submissions

feat: add evaluation workflow

feat: integrate rubric based evaluator

feat: add feedback history

test: cover submission and evaluation failures

docs: add research and design notes

docs: add AI usage decisions
```

Avoid:

```text
final
final2
final-final
working
latest
```

---

# PHASE 25: Final Repository

```text
lld-practice-platform/
│
├── frontend/
│   └── src/
│
├── backend/
│   ├── src/
│   │   ├── domain/
│   │   │   ├── evaluator/
│   │   │   └── submission/
│   │   │
│   │   ├── modules/
│   │   │   ├── problems/
│   │   │   ├── attempts/
│   │   │   ├── submissions/
│   │   │   └── evaluations/
│   │   │
│   │   └── app.ts
│   │
│   ├── prisma/
│   └── tests/
│
├── docs/
│   ├── RESEARCH.md
│   └── DESIGN.md
│
├── AI_USAGE.md
├── README.md
├── .env.example
└── package.json
```

---

# PHASE 26: Two-Day Execution

## DAY 1

### Block 1

**Research**

`RESEARCH.md`

### Block 2

**Freeze product**

* four problems
* text submission
* rubric
* user flow

### Block 3

**Domain design**

* Problem
* Attempt
* Submission
* Evaluation
* Feedback
* Rubric
* Evaluator

### Block 4

**Database**

Prisma schema + migrations.

### Block 5

**Backend**

Problems → Attempts → Submissions.

### Block 6

**Frontend**

Problems → Practice → Submit.

### End of Day 1

You should already have:

```text
Select problem
 ↓
Create attempt
 ↓
Submit design
 ↓
Database stores it
```

If that doesn't work, **do not start polishing UI.**

---

# DAY 2

### Block 1

Evaluation service.

### Block 2

LLM evaluator + structured JSON.

### Block 3

Feedback UI.

### Block 4

Attempt history + retry.

### Block 5

Failure handling.

### Block 6

Tests.

### Block 7

README + DESIGN + AI_USAGE.

### Block 8

Deployment/demo if everything else is stable.

---

# PHASE 27: What We Cut Immediately

These are officially **out of scope**.

```text
❌ Kafka implementation
❌ Redis implementation
❌ Microservices
❌ Kubernetes
❌ UML editor
❌ Diagram parser
❌ Code execution
❌ Authentication system
❌ Social features
❌ Leaderboards
❌ Chat
❌ Notifications
❌ 50+ problems
❌ Fancy analytics
❌ Mobile app
```

If you get extra time, improve:

```text
1. Evaluation quality
2. Feedback quality
3. Domain design
4. Tests
5. UI polish
```

Not infrastructure.

---

# PHASE 28: What Makes This Top-Tier

The reviewer should discover these things naturally:

### 1. Narrow scope

You clearly understood this is a prototype.

### 2. Strong domain model

```text
Problem
→ Attempt
→ Submission
→ Evaluation
→ Feedback
```

### 3. Real abstractions

```text
Evaluator
SubmissionContent
```

Not meaningless interfaces.

### 4. Clean failure handling

```text
Save first
Evaluate second
```

### 5. Explainable AI

```text
Criterion
→ Score
→ Evidence
→ Concern
→ Suggestion
→ Confidence
```

### 6. Database integrity

```text
Submission 1 : 1 Evaluation
UNIQUE(submissionId)
```

### 7. Learning loop

```text
Attempt 1
 ↓
Feedback
 ↓
Attempt 2
 ↓
Improvement
```

### 8. Honest engineering

You explicitly explain:

> "We didn't build X because it wasn't necessary for the MVP."

That's much stronger than pretending you didn't have time.

---

# Final Architecture

Lock this:

```text
                         React
                           │
                           ↓
                     Express API
                           │
                    ┌──────┴──────┐
                    ↓             ↓
               Application      Domain
                 Services       Models
                    │             │
                    └──────┬──────┘
                           ↓
                        Prisma
                           ↓
                      PostgreSQL


                  Evaluation Service
                           │
                           ↓
                       Evaluator
                           │
                           ↓
                     LLMEvaluator
                           │
                           ↓
                      OpenAI API
```

Future scaling is discussed, not implemented:

```text
                    Evaluation Queue
                          │
             ┌────────────┴────────────┐
             ↓                         ↓
          Redis                     Kafka
       coordination              event stream
```

---

# Final Product Loop

This is the entire project in one diagram:

```text
                ┌─────────────┐
                │   Problem   │
                └──────┬──────┘
                       ↓
                ┌─────────────┐
                │   Attempt   │
                └──────┬──────┘
                       ↓
              ┌─────────────────┐
              │ Design Submission│
              └────────┬────────┘
                       ↓
                ┌─────────────┐
                │  Evaluator  │
                └──────┬──────┘
                       ↓
                ┌─────────────┐
                │  Evaluation │
                └──────┬──────┘
                       ↓
                 ┌──────────┐
                 │ Feedback │
                 └────┬─────┘
                      ↓
                   Improve
                      ↓
                    Retry
                      │
                      └──────────→ New Attempt
```

## The final rule

**Do not add anything else to the architecture now.**

The earlier plan had too much infrastructure and too many phases. This version fixes the specific problems in the critique:

* single application
* realistic ~23–24 focused hours
* no unnecessary Redis/Kafka implementation
* `Submission 1:1 Evaluation`
* DB-level uniqueness on `submissionId`
* genuine evaluator abstraction
* text-first submission with future diagram/code support
* structured AI evaluation
* save-before-evaluate failure handling
* four focused problems
* four concise documents
* deployment treated as secondary
* clear priority order under time pressure

And the competitive research reinforces the same conclusion: don't try to out-feature existing platforms like LLDCanvas or InstaMock in two days. Build a **small, coherent evaluation-first workflow** and make the engineering decisions exceptionally clear. ([LLDCanvas][1])

**This is the plan I would freeze. Next we should execute Phase 1, `RESEARCH.md`, and then immediately freeze the Prisma/domain schema before writing application code.**

[1]: https://www.lldcanvas.in/?utm_source=chatgpt.com "LLDCanvas - Free LLD & System Design Interview Preparation Platform"
[2]: https://instamock.in/lld?utm_source=chatgpt.com "LLD Mock Interview & Practice – Low Level Design | InstaMock | InstaMock - AI Mock Interview"
