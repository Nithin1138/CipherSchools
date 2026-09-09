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

## 2. Current Practice Methods

Aspiring software engineers typically practice LLD using three main methods:
1. **Ad-hoc Whiteboarding & Scratchpads**: Sketching class diagrams and interfaces on scratchpads or whiteboard apps without systematic evaluation.
2. **Reading Static Reference Repositories**: Browsing GitHub repositories containing pre-baked implementations of common LLD questions. While informative, this is passive reading—learners don't get feedback on their own unique design trade-offs.
3. **Pasting Solutions into Generic Chatbots**: Asking general-purpose chatbots (ChatGPT, Claude) to "review my code." This yields erratic scoring, arbitrary praise, and hallucinations because the chatbot lacks a calibrated rubric or grounding constraints.

---

## 3. Existing Platforms & Market Analysis

| Platform / Approach | Primary Focus | Strengths | Critical Gaps |
|---|---|---|---|
| **LLDCanvas** | Visual UML editing, Draft notation, Code execution, timed practice | Excellent visual editing tools; interactive diagramming; code execution. | Focuses on visual drawing and coding rather than structured, rubric-based feedback on design thinking. |
| **InstaMock** | AI mock interviews for system design & LLD | Real-time conversational interview simulation; voice/chat interaction. | Broad interview simulation; feedback is often generic conversational summaries rather than structured, criterion-by-criterion evidence. |
| **Traditional Courses & Articles** | Static tutorials (e.g. Medium, GitHub repos) | In-depth reference solutions and established design pattern walk-throughs. | Passive learning. Learners read a finished solution without validating their own design reasoning or learning through iteration. |
| **Generic LLMs (ChatGPT / Claude)** | Free-form prompt querying | Flexible; generates instant feedback on any prompt. | Unconstrained scoring; arbitrary "8/10" ratings without grounded rubrics; hallucinated critique not anchored to student evidence. |

---

## 4. What Existing Platforms Do Well

1. **Visual Representation**: Platforms like LLDCanvas provide rich drawing surfaces for UML and class diagrams.
2. **Interactive Simulation**: Platforms like InstaMock create conversational pressure that mimics real-time interviews.
3. **Reference Architectures**: Curated blogs and repositories offer high-quality examples of canonical design patterns (Factory, Strategy, Observer).

---

## 5. Identified Gaps & Opportunities

Most current platforms fail to address the core pedagogical requirement of LLD practice:
1. **Uncalibrated, Non-Deterministic Scoring**: Generic AI tools output arbitrary overall scores without structured sub-scores or consistent grading criteria across attempts.
2. **Hallucinated Feedback**: Generic LLMs frequently praise or criticize components the student never actually wrote (e.g., claiming "Good use of Redis caching" when the student only designed in-memory classes).
3. **Lack of an Iterative Practice Loop**: Existing tools lack a formal retry mechanism where previous attempts are preserved, allowing learners to compare feedback across attempts and track measurable improvement.
4. **Tooling Overhead vs. Design Reasoning**: Visual canvas tools demand 80% of the learner's effort for diagram aesthetics rather than design reasoning, object modeling, and trade-off justification.

---

## 6. Product Direction & The Practice Loop

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

By focusing strictly on this loop—rather than building a complex UML editor, an LMS, or distributed infrastructure—the platform delivers immediate pedagogical value within a clean, robust, and testable modular architecture.
