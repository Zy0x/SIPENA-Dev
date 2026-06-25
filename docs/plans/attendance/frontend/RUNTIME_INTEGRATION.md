# FRONTEND RUNTIME INTEGRATION

## PURPOSE
Switch engine tanpa reload logic UI

---

## FLOW

App Load →
  Read runtime config →
    set active engine →
      mount provider

---

## COMPONENT

<AttendanceRuntimeProvider />

---

## RULE
- UI tidak boleh import V1 or V2 directly
- hanya runtime adapter