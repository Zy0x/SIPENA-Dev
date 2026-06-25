# CANONICAL OUTPUT MODEL

## PURPOSE
Unify V1 and V2 output so export system never breaks.

---

## STRUCTURE

{
  student_id,
  date,
  status,
  metadata,
  source_engine (hidden)
}

---

## RULE
- Export system NEVER sees engine difference
- Only sees canonical structure