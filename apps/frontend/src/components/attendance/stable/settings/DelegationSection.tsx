import React from "react";
import {
  RotateCcw,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Delegation } from "@/hooks/useAttendanceStable";

import {
  SectionIntro,
  InfoHelp,
  EmptyState,
  formatDateOnly,
} from "./SettingsShared";

export interface DelegationSectionProps {
  delegations: Delegation[];
  handleRevokeDelegationAction: (id: string) => Promise<void>;
  isRevokingDelegation: boolean;
  onAddDelegationClick: () => void;
}

export const DelegationSection: React.FC<DelegationSectionProps> = ({
  delegations,
  handleRevokeDelegationAction,
  isRevokingDelegation,
  onAddDelegationClick,
}) => {
  return (
    <div className="space-y-4" data-tour="attendance-settings-delegation">
      <SectionIntro
        icon={UserPlus}
        title="Delegasi Guru Pengganti"
        description="Berikan akses pengisian presensi kelas sementara kepada rekan guru pendamping/piket tanpa membagikan kata sandi akun Anda."
        help={
          <InfoHelp
            label="Delegasi Guru"
            summary="Mendelegasikan akses edit presensi kelas sementara."
            detail="Fitur ini membolehkan guru pengganti mengisi presensi kelas Anda selama kurun waktu yang disepakati, dengan audit log tetap mencatat editor aslinya."
            example="Guru pendamping diberi wewenang mengisi presensi kelas dari tanggal 10 s/d 12 Juli."
            impact="Akses aman mencegah penyalahgunaan akun utama dan menjaga keamanan data."
          />
        }
        action={
          <Button
            type="button"
            className="h-10 min-h-[40px] rounded-xl text-xs font-bold gap-1 shadow-sm"
            onClick={onAddDelegationClick}
            data-tour="attendance-settings-delegation-add"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Tambah Delegasi</span>
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-delegation-list">
        <div className="mb-3 border-b pb-2">
          <h4 className="text-sm font-bold text-foreground">Daftar Delegasi Aktif</h4>
          <p className="text-xs text-muted-foreground">Hak akses guru piket yang saat ini sedang berlaku.</p>
        </div>
        <div className="divide-y max-h-72 overflow-y-auto pr-1">
          {delegations.length === 0 ? (
            <EmptyState icon={UserPlus} text="Belum ada pendelegasian aktif untuk kelas ini." compact />
          ) : (
            delegations.map((delegation) => (
              <div key={delegation.id} className="flex flex-col gap-3 py-3 transition-colors hover:bg-muted/10 px-1.5 rounded-lg sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground leading-snug">{delegation.grantee_label || delegation.grantee_user_id}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Masa Berlaku: {formatDateOnly(delegation.starts_at)} s/d {formatDateOnly(delegation.ends_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 min-h-[36px] rounded-xl text-xs font-bold text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 shrink-0"
                  onClick={() => handleRevokeDelegationAction(delegation.id)}
                  disabled={isRevokingDelegation}
                >
                  {isRevokingDelegation ? (
                    <RotateCcw className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : null}
                  <span>Cabut Izin</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
