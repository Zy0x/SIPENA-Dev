# ATTENDANCE API SPEC

## PRINCIPLE
API tidak boleh berubah drastis agar tidak merusak frontend & export.

---

## CORE ENDPOINTS

### GET /attendance
Returns canonical attendance dataset (engine-independent)

---

### POST /attendance
Routes to:
- V1 service OR
- V2 service (based on runtime switch)

---

### GET /attendance/summary
Always uses canonical output format

---

## IMPORTANT RULE
Frontend NEVER knows engine type