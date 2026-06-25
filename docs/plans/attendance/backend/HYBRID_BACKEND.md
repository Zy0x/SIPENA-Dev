# HYBRID BACKEND ARCHITECTURE

## CORE PRINCIPLE
Backend SIPENA Attendance harus mendukung 2 engine:

- V1 → legacy system (READ ONLY)
- V2 → new engine (rule-based system)

## STRATEGY
Backend TIDAK BOLEH dipisah total.
Backend harus menjadi ORCHESTRATION LAYER.

---

## ARCHITECTURE

Client → API Gateway → Runtime Router → Engine Selector

                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
     Attendance V1                  Attendance V2
   (legacy service)             (new engine service)

---

## RULE
- V1 service = immutable
- V2 service = fully modular
- router decides execution path