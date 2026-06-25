# API CONTRACT BLUEPRINT: Attendance V2

This document defines the REST API contract between the V2 frontend client and the backend modules.

---

## 1. REST Endpoint Contracts

All request and response objects use the Canonical structures.

### GET `/api/attendance/records`
- **Query Params**:
  - `classId`: string (required)
  - `month`: string (YYYY-MM, required)
- **Response**: `200 OK`
  ```json
  {
    "records": [
      {
        "id": "rec-123",
        "studentId": "stud-456",
        "classId": "class-789",
        "date": "2026-06-25",
        "status": "H",
        "note": null
      }
    ],
    "isLocked": false
  }
  ```

### POST `/api/attendance/record`
- **Request Body**:
  ```json
  {
    "studentId": "stud-456",
    "classId": "class-789",
    "date": "2026-06-25",
    "status": "S",
    "note": "Sakit gigi"
  }
  ```
- **Response**: `200 OK` or `201 Created` returning the created `CanonicalRecord`.

---

## 2. API Schema Validation Rules
- All requests are validated against the backend schema rules before database updates.
- If validation fails, the API immediately returns `400 Bad Request` with structured error feedback detailing invalid fields, avoiding partial writes.
- Unauthorized calls return `401 Unauthorized` or `403 Forbidden` using the active session credentials.
