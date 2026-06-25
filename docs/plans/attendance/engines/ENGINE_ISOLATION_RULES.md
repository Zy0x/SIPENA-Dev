# ENGINE ISOLATION RULES

## CRITICAL RULE

V1 and V2 must NEVER interact directly

---

## FORBIDDEN

- shared state mutation
- direct function calls between engines
- shared business logic files

---

## ALLOWED

- communication ONLY via canonical model
- communication ONLY via adapter layer