import { useMemo } from "react";
import { useClasses, type Class } from "@/hooks/useClasses";
import { useGuestAccesses, type GuestAccessClass } from "@/hooks/useGuestAccesses";

export type OwnerAccessibleClass = Class & { accessKind: "owner" };
export type AccessibleClass = OwnerAccessibleClass | GuestAccessClass;

export function useAccessibleClasses() {
  const classesQuery = useClasses();
  const guestAccessQuery = useGuestAccesses();

  const ownerClasses = useMemo<OwnerAccessibleClass[]>(
    () => classesQuery.classes.map((item) => ({ ...item, accessKind: "owner" as const })),
    [classesQuery.classes],
  );

  const accessibleClasses = useMemo<AccessibleClass[]>(
    () => [...ownerClasses, ...guestAccessQuery.activeGuestClasses],
    [ownerClasses, guestAccessQuery.activeGuestClasses],
  );

  return {
    ownerClasses,
    guestClasses: guestAccessQuery.activeGuestClasses,
    inactiveGuestClasses: guestAccessQuery.inactiveGuestClasses,
    accessibleClasses,
    isLoading: classesQuery.isLoading || guestAccessQuery.isLoading,
    owner: classesQuery,
    guest: guestAccessQuery,
  };
}
