# LLD Practice Platform - REST API Reference

The LLD Practice Platform provides a clean RESTful API to manage the practice lifecycle:
`Problem → Attempt → Submission → Evaluation → Feedback`.

All endpoints are mounted under `/api`. All error responses follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

---

## 1. Problems

### List All Problems
- **Method**: `GET`
- **Endpoint**: `/api/problems`
- **Description**: Returns all 4 curated LLD problems with title, summary, and metadata.
- **Response**: `200 OK`
  ```json
  {
    "problems": [
      {
        "id": "uuid",
        "slug": "parking-lot",
        "title": "Parking Lot",
        "description": "...",
        "requirements": ["..."],
        "constraints": ["..."]
      }
    ]
  }
  ```

### Get Problem by ID
- **Method**: `GET`
- **Endpoint**: `/api/problems/:id`
- **Description**: Returns full problem specifications (problem statement, requirements, constraints).
- **Response**: `200 OK` (`{ "problem": { ... } }`)
- **Errors**: `404 Not Found` if `id` does not exist.

### Get Problem by Slug
- **Method**: `GET`
- **Endpoint**: `/api/problems/slug/:slug`
- **Description**: Returns problem specifications using human-readable slug (e.g. `parking-lot`).
- **Response**: `200 OK` (`{ "problem": { ... } }`)
- **Errors**: `404 Not Found` if `slug` does not exist.

---

## 2. Attempts

### Create Practice Attempt
- **Method**: `POST`
- **Endpoint**: `/api/problems/:problemId/attempts`
- **Description**: Starts a new practice attempt for a problem. Starts in `IN_PROGRESS` state. Preserves any previous attempts.
- **Response**: `201 Created`
  ```json
  {
    "attempt": {
      "id": "uuid",
      "problemId": "uuid",
      "status": "IN_PROGRESS",
      "startedAt": "2026-09-08T..."
    }
  }
  ```
- **Errors**:
  - `400 Bad Request` if `problemId` is missing/invalid.
  - `404 Not Found` if problem does not exist.

### Get Attempt Details
- **Method**: `GET`
- **Endpoint**: `/api/attempts/:attemptId`
- **Description**: Returns attempt details including associated problem, submission, evaluation, and feedback (if completed).
- **Response**: `200 OK` (`{ "attempt": { ... } }`)
- **Errors**: `404 Not Found` if attempt does not exist.

### Get Problem Attempt History
- **Method**: `GET`
- **Endpoint**: `/api/problems/:problemId/attempts`
- **Description**: Lists all historical attempts for a problem to track progress over time.
- **Response**: `200 OK` (`{ "attempts": [ ... ] }`)

---

## 3. Submissions

### Submit Design Solution
- **Method**: `POST`
- **Endpoint**: `/api/attempts/:attemptId/submission`
- **Description**: Submits the candidate's LLD design text for the attempt. Marks the attempt `COMPLETED`. Immutable once submitted.
- **Request Body**:
  ```json
  {
    "content": "Design description (minimum 20 characters)...",
    "type": "TEXT"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "submission": {
      "id": "uuid",
      "attemptId": "uuid",
      "type": "TEXT",
      "content": "...",
      "submittedAt": "2026-09-08T..."
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: Empty content, whitespace only, or fewer than 20 characters.
  - `404 Not Found`: Attempt does not exist.
  - `409 Conflict`: Attempt already has a submission (strict 1:1 rule).

### Get Submission by ID
- **Method**: `GET`
- **Endpoint**: `/api/submissions/:submissionId`
- **Description**: Retrieves submitted design content and linked evaluation status.
- **Response**: `200 OK` (`{ "submission": { ... } }`)
- **Errors**: `404 Not Found` if submission does not exist.

---

## 4. Evaluations

### Evaluate Submission
- **Method**: `POST`
- **Endpoint**: `/api/submissions/:submissionId/evaluation`
- **Description**: Evaluates the submitted design against the 7-dimension rubric using the configured evaluator abstraction.
- **Response**: `201 Created`
  ```json
  {
    "evaluation": {
      "id": "uuid",
      "submissionId": "uuid",
      "status": "COMPLETED",
      "totalScore": 82,
      "maxScore": 100,
      "feedback": [
        {
          "criterionName": "Entity Modeling & Architecture",
          "score": 18,
          "maxScore": 20,
          "evidence": "Defined ParkingLot, Level, Spot...",
          "concern": "Spot type coupling...",
          "suggestion": "Introduce SpotType enum or strategy...",
          "confidence": 0.95
        }
      ]
    }
  }
  ```
- **Errors**:
  - `404 Not Found`: Submission does not exist.
  - `500 Internal Server Error`: Evaluation failed during processing (evaluation marked `FAILED` for retry).

### Get Evaluation Details
- **Method**: `GET`
- **Endpoint**: `/api/evaluations/:evaluationId`
- **Description**: Retrieves evaluation scores, status, and sorted criterion feedback.
- **Response**: `200 OK` (`{ "evaluation": { ... } }`)
- **Errors**: `404 Not Found` if evaluation does not exist.

### Retry Failed Evaluation
- **Method**: `POST`
- **Endpoint**: `/api/evaluations/:evaluationId/retry`
- **Description**: Retries an evaluation that previously failed (e.g. timeout or rate-limit). Transitions `FAILED → EVALUATING → COMPLETED` in-place without creating duplicate rows.
- **Response**: `200 OK` (`{ "evaluation": { ... } }`)
- **Errors**:
  - `400 Bad Request`: Cannot retry an evaluation that is not in `FAILED` state (e.g. `COMPLETED`).
  - `404 Not Found`: Evaluation does not exist.
