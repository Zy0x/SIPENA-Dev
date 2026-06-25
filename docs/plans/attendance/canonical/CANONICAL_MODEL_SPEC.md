# CANONICAL MODEL SPECIFICATION: Attendance V2

This document details the specifications of the engine-agnostic Attendance Canonical Model interfaces and schemas.

## Overview
The Canonical Model decouples internal engine storage implementations from consumer screens and report sheets. It normalizes attributes to a single clean schema.

## Schemas
- **AttendanceStatusCode**: Explicit type `"H" | "S" | "I" | "A" | "D" | "L" | "-"`.
- **AttendanceRecordCanonical**: Represents a singular check-in. Exposes camelCase fields (`studentId`, `classId`, `date`, `status`, `note`).
- **AttendanceDatasetCanonical**: Captures a full month payload containing murid arrays, records, custom holidays, calendar events, and locks.
