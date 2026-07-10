import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/repositories/supabase-compat.repository", () => ({
  supabaseExternal: {},
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

import { normalizeGuestAccessRows, type GuestAccessRow } from "./useGuestAccesses";

function row(overrides: Partial<GuestAccessRow>): GuestAccessRow {
  return {
    grant_id: "grant-1",
    shared_link_id: "link-1",
    token: "token-1",
    owner_user_id: "owner-1",
    owner_email: "owner@example.com",
    owner_name: "Guru Pemilik",
    class_id: "class-1",
    class_name: "VIIA",
    class_description: "Kelas tamu",
    class_kkm: 75,
    class_academic_year_id: "year-1",
    class_semester_id: "semester-1",
    subject_id: "subject-1",
    subject_name: "Bahasa Indonesia",
    subject_kkm: 75,
    subject_is_custom: false,
    subject_academic_year_id: "year-1",
    student_count: 20,
    accepted_at: "2026-07-10T01:00:00.000Z",
    last_used_at: "2026-07-10T02:00:00.000Z",
    expired_at: "2027-07-10T01:00:00.000Z",
    revoked: false,
    grant_status: "active",
    is_active: true,
    ...overrides,
  };
}

describe("guest access normalization", () => {
  it("groups several shared subjects into one guest class card", () => {
    const grouped = normalizeGuestAccessRows([
      row({ shared_link_id: "link-b", token: "token-b", subject_id: "subject-b", subject_name: "Matematika" }),
      row({ shared_link_id: "link-a", token: "token-a", subject_id: "subject-a", subject_name: "Bahasa Indonesia" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      accessKind: "guest",
      id: "class-1",
      ownerName: "Guru Pemilik",
      studentCount: 20,
      isActive: true,
    });
    expect(grouped[0].subjects.map((subject) => subject.name)).toEqual(["Bahasa Indonesia", "Matematika"]);
  });

  it("keeps inactive grants visible for inactive access handling", () => {
    const grouped = normalizeGuestAccessRows([
      row({ grant_status: "active", revoked: true, is_active: false }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].isActive).toBe(false);
    expect(grouped[0].subjects[0].isActive).toBe(false);
  });
});
