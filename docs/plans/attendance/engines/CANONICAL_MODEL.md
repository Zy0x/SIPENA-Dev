# CANONICAL ATTENDANCE MODEL

## PURPOSE
Bridge V1 & V2 outputs into single format

---

## STRUCTURE

{
  student_id,
  date,
  status,
  source_engine,
  metadata,
  event_context
}

---

## RULE
- Export only reads canonical model
- UI only reads canonical model
- engine is hidden