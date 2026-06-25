# RUNTIME SWITCH SYSTEM

## Concept
System selects engine dynamically:

- V1 → legacy production
- V2 → new architecture

## RULE
Switch must NOT require:
- DB migration
- code rewrite
- export change

Only config change allowed:
runtime_engine = "v1 | v2"