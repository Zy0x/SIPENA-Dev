import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react-dom/test-utils";

// Mock Supabase
vi.mock("@/core/repositories/supabase-compat.repository", () => ({
  supabaseExternal: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

// Mock react-query (all mock functions inline to prevent hoisting reference errors)
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() }),
  useMutation: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
  useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn(() => []), invalidateQueries: vi.fn() }),
}));

// Mock useAuth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({ user: { id: "user-1", email: "user@school.com" } }),
}));

// Mock Toast
vi.mock("@/contexts/ToastContext", () => ({
  useEnhancedToast: vi.fn().mockReturnValue({ success: vi.fn(), error: vi.fn() }),
}));

// Mock runtime hook
vi.mock("../runtime/useAttendanceRuntime", () => ({
  useAttendanceRuntime: () => ({ engine: "v2", mode: "active" }),
}));

import { useAttendanceV2Adapter, V2AdapterResult } from "./attendanceV2.adapter";

describe("useAttendanceV2Adapter persistence hook configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes queries and returns expected V2 engine functions", () => {
    let adapterResult: V2AdapterResult | null = null;

    function TestComponent() {
      adapterResult = useAttendanceV2Adapter("class-1", new Date("2026-06-01"), "6days");
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => {
      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(TestComponent));
    });

    expect(adapterResult).toBeDefined();
    expect(typeof adapterResult!.getAttendance).toBe("function");
    expect(typeof adapterResult!.setAttendance).toBe("function");
    expect(typeof adapterResult!.updateNote).toBe("function");
    expect(typeof adapterResult!.bulkSetAttendance).toBe("function");
    expect(typeof adapterResult!.toggleLock).toBe("function");
    expect(adapterResult!.isLoading).toBe(false);

    document.body.removeChild(container);
  });
});
