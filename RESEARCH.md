# Research Note: LLD Practice Platform

## 1. The Learner Problem

Low-Level Design (LLD) is notoriously easy to attempt but difficult to self-evaluate. 

When candidates practice designing systems like a **Parking Lot**, **Elevator System**, **Vending Machine**, or **Food Delivery App**, they can quickly sketch out classes, interfaces, and methods. However, they are left with fundamental uncertainties:
- *Are these class responsibilities cohesive, or did I create a god-object?*
- *Is this abstraction actually decoupling components, or is it premature complexity?*
- *How fragile is this design when requirements inevitably change (e.g., adding EV charging spots or dynamic surge pricing)?*
- *Are edge cases, race conditions, and thread safety adequately addressed?*

In traditional algorithmic coding (LeetCode), unit tests give immediate deterministic feedback (Pass/Fail, Time Complexity). In LLD, **there is rarely a single "correct" solution**; valid designs differ based on assumptions, trade-offs, and extensibility goals.

---

## 2. Existing Approaches & Market Analysis

| Platform / Approach | Primary Focus | Strengths | Critical Gaps |
|---|---|---|---|
| **LLDCanvas** | Visual UML editing, Draft notation, Code execution, timed practice | Excellent visual editing tools; interactive diagramming; code execution. | Focuses on visual drawing and coding rather than structured, rubric-based feedback on design thinking. |
| **InstaMock** | AI mock interviews for system design & LLD | Real-time conversational interview simulation; voice/chat interaction. | Broad interview simulation; feedback is often generic conversational summaries rather than structured, criterion-by-criterion evidence. |
| **Traditional Courses & Articles** | Static tutorials (e.g. Medium, GitHub repos) | In-depth reference solutions and established design pattern walk-throughs. | Passive learning. Learners read a finished solution without validating their own design reasoning or learning through iteration. |
| **Generic LLMs (ChatGPT / Claude)** | Free-form prompt querying | Flexible; generates instant feedback on any prompt. | Unconstrained scoring; arbitrary "8/10" ratings without grounded rubrics; hallucinated critique not anchored to student evidence. |

---

## 3. The Identified Gap

Most current platforms either:
1. Turn LLD into a **drawing exercise** (drag-and-drop UML), or
2. Turn it into a **code-execution exercise** (implementing boilerplate code), or
3. Rely on **unstructured conversational AI** that provides superficial praise or generic comments.

**The missing piece:**
> A focused practice loop where the **learner's design reasoning is the central artifact**, evaluated against an **explicit, multi-dimensional rubric** with **evidence-backed, explainable feedback** that empowers the learner to improve on their next attempt.

---

## 4. Product Direction & The Practice Loop

To solve this, our product establishes a disciplined, iterative learning loop:

```text
    ┌───────────────┐
    │ Choose Problem│ (1 of 4 distinct LLD challenges)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Start Attempt │ (Preserves historical progress)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Design Text   │ (Entities, responsibilities, patterns, trade-offs)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Submit Design │ (Persisted BEFORE evaluation begins)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Rubric Assess │ (Evaluates against 7 standard dimensions)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Actionable    │ (Scores + Evidence quotes + Specific concerns + Suggestions)
    │ Feedback      │
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │   Try Again   │ ──► Creates New Attempt (Attempt 2)
    └───────────────┘     Preserves Attempt 1 history for comparison
```

By focusing strictly on this loop—rather than building a complex UML editor, an LMS, or distributed infrastructure—the platform delivers immediate pedagogical value within the 2-day assignment scope.
