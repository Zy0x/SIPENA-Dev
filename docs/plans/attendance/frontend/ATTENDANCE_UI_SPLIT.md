# ATTENDANCE UI SPLIT ARCHITECTURE

## CORE PRINCIPLE
Frontend tidak boleh tahu engine (V1 / V2)

---

## ARCHITECTURE

UI Layer
   │
Runtime Provider
   │
Engine Adapter
   │
Backend API (hidden)

---

## ENGINE MODES

- MODE V1 → legacy UI flow
- MODE V2 → new reactive UI flow

---

## RULE
UI hanya consume "canonical data"