# SESSION RECOVERY PROTOCOL

If session is reset or compacted:

## STEP ORDER

1. Read PROJECT_CONTEXT
2. Read PROJECT_STATE
3. Read CURRENT_PHASE
4. Read DECISIONS
5. Read NEXT_ACTION
6. Resume execution

---

## STRICT RULE
Do NOT re-analyze completed phases