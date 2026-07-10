import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";

export interface GuestAccessSubject {
  grantId: string;
  sharedLinkId: string;
  token: string;
  id: string;
  name: string;
  kkm: number;
  isCustom: boolean;
  academicYearId: string | null;
  acceptedAt: string;
  lastUsedAt: string | null;
  expiredAt: string;
  revoked: boolean;
  grantStatus: string;
  isActive: boolean;
}

export interface GuestAccessClass {
  accessKind: "guest";
  id: string;
  name: string;
  description: string | null;
  classKkm: number | null;
  academicYearId: string | null;
  semesterId: string | null;
  studentCount: number;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  subjects: GuestAccessSubject[];
  lastUsedAt: string | null;
  acceptedAt: string;
  isActive: boolean;
}

export interface GuestAccessRow {
  grant_id: string;
  shared_link_id: string;
  token: string;
  owner_user_id: string;
  owner_email: string | null;
  owner_name: string | null;
  class_id: string;
  class_name: string;
  class_description: string | null;
  class_kkm: number | null;
  class_academic_year_id: string | null;
  class_semester_id: string | null;
  subject_id: string;
  subject_name: string;
  subject_kkm: number;
  subject_is_custom: boolean;
  subject_academic_year_id: string | null;
  student_count: number | string | null;
  accepted_at: string;
  last_used_at: string | null;
  expired_at: string;
  revoked: boolean;
  grant_status: string;
  is_active: boolean;
}

type GuestAccessRpcClient = {
  rpc: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>;
};

const guestAccessRpc = supabase as unknown as GuestAccessRpcClient;

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function newestDate(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function normalizeGuestAccessRows(rows: GuestAccessRow[] = []): GuestAccessClass[] {
  const grouped = new Map<string, GuestAccessClass>();

  rows.forEach((row) => {
    const classKey = row.class_id;
    const subject: GuestAccessSubject = {
      grantId: row.grant_id,
      sharedLinkId: row.shared_link_id,
      token: row.token,
      id: row.subject_id,
      name: row.subject_name,
      kkm: row.subject_kkm,
      isCustom: row.subject_is_custom,
      academicYearId: row.subject_academic_year_id,
      acceptedAt: row.accepted_at,
      lastUsedAt: row.last_used_at,
      expiredAt: row.expired_at,
      revoked: row.revoked,
      grantStatus: row.grant_status,
      isActive: row.is_active,
    };

    const existing = grouped.get(classKey);
    if (!existing) {
      grouped.set(classKey, {
        accessKind: "guest",
        id: row.class_id,
        name: row.class_name,
        description: row.class_description,
        classKkm: row.class_kkm,
        academicYearId: row.class_academic_year_id,
        semesterId: row.class_semester_id,
        studentCount: toNumber(row.student_count),
        ownerUserId: row.owner_user_id,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        subjects: [subject],
        acceptedAt: row.accepted_at,
        lastUsedAt: row.last_used_at,
        isActive: row.is_active,
      });
      return;
    }

    existing.subjects.push(subject);
    existing.isActive = existing.isActive || row.is_active;
    existing.lastUsedAt = newestDate(existing.lastUsedAt, row.last_used_at);
  });

  return Array.from(grouped.values())
    .map((guestClass) => ({
      ...guestClass,
      subjects: guestClass.subjects.sort((a, b) => a.name.localeCompare(b.name, "id")),
    }))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bTime - aTime || a.name.localeCompare(b.name, "id");
    });
}

export function buildGuestSessionPayload(params: {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  access: GuestAccessClass;
  subject: GuestAccessSubject;
}) {
  const guestName = params.userName || params.userEmail?.split("@")[0] || "Guru Tamu";
  return {
    guestId: params.userId || `guest-access-${params.subject.grantId}`,
    name: guestName,
    email: params.userEmail || "",
    token: params.subject.token,
    sharedLinkId: params.subject.sharedLinkId,
    subjectId: params.subject.id,
    classId: params.access.id,
    userId: params.access.ownerUserId,
    isMainTeacher: true,
    mainUserId: params.userId || null,
  };
}

export function useGuestAccesses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["guest_accesses", user?.id],
    queryFn: async () => {
      if (!user) return [] as GuestAccessRow[];
      const { data, error } = await guestAccessRpc.rpc<GuestAccessRow[]>("get_my_guest_accesses");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const guestClasses = useMemo(() => normalizeGuestAccessRows(query.data || []), [query.data]);
  const activeGuestClasses = useMemo(
    () => guestClasses
      .map((guestClass) => ({
        ...guestClass,
        subjects: guestClass.subjects.filter((subject) => subject.isActive),
      }))
      .filter((guestClass) => guestClass.subjects.length > 0),
    [guestClasses],
  );
  const inactiveGuestClasses = useMemo(
    () => guestClasses.filter((guestClass) => !guestClass.subjects.some((subject) => subject.isActive)),
    [guestClasses],
  );

  const acceptGuestAccess = useMutation({
    mutationFn: async ({ token, guestUserId }: { token: string; guestUserId?: string | null }) => {
      const { data, error } = await guestAccessRpc.rpc("accept_guest_access", {
        p_token: token,
        p_guest_user_id: guestUserId || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest_accesses"] });
    },
  });

  const touchGuestAccess = useMutation({
    mutationFn: async (sharedLinkId: string) => {
      const { error } = await guestAccessRpc.rpc("touch_guest_access", {
        p_shared_link_id: sharedLinkId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest_accesses"] });
    },
  });

  return {
    guestAccessRows: query.data || [],
    guestClasses,
    activeGuestClasses,
    inactiveGuestClasses,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    acceptGuestAccess,
    touchGuestAccess,
  };
}
