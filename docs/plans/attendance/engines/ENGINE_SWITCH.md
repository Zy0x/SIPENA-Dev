# ENGINE SWITCH SYSTEM

## PURPOSE
Switch V1 and V2 without breaking system

---

## INPUT

runtime_engine = "v1 | v2"

---

## FLOW

Request →
  Switcher →
    if v1 → V1 Adapter
    if v2 → V2 Engine

---

## RULE
- switch must NOT require redeploy
- switch must NOT change database