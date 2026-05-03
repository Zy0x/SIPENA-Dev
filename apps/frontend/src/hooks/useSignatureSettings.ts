import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";

export interface SignatureSigner {
  id: string;
  name: string;
  title: string;
  nip: string;
  school_name: string;
  order_index?: number;
}

export type SignatureAlignment = 'left' | 'center' | 'right';
export type SignaturePlacementMode = 'adaptive' | 'flow' | 'fixed';
export type SignaturePreset = 'follow-content' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type SignatureLinePosition = 'above-name' | 'between-name-and-nip';
export type SignatureLineLengthMode = 'fixed' | 'name' | 'nip';

export interface SignatureSettingsConfig {
  city: string;
  signers: SignatureSigner[];
  useCustomDate: boolean;
  customDate: string | null;
  fontSize: number;
  showSignatureLine: boolean;
  signatureLinePosition?: SignatureLinePosition;
  signatureLineLengthMode?: SignatureLineLengthMode;
  signatureLineWidth: number; // in mm for PDF
  signatureSpacing: number; // gap between signers in mm
  // Position controls
  signatureAlignment: SignatureAlignment; // horizontal alignment
  signatureOffsetX: number; // horizontal offset in mm (from aligned position)
  signatureOffsetY: number; // vertical offset in mm (from default position after content)
  placementMode: SignaturePlacementMode;
  signaturePreset: SignaturePreset;
  manualXPercent: number | null;
  manualYPercent: number | null;
  snapToGrid: boolean;
  gridSizeMm: number;
  lockSignaturePosition: boolean;
  showDebugGuides: boolean;
  /**
   * Index of the page (0-based) where the signature should appear.
   * `null` = let the planner decide (default: last page).
   * Set explicitly to move TTD between pages manually.
   */
  signaturePageIndex: number | null;
}

export interface SignatureSettings {
  id: string;
  user_id: string;
  city: string;
  name: string;
  title: string;
  nip: string;
  school_name: string;
  signers?: SignatureSigner[];
  use_custom_date?: boolean;
  custom_date?: string | null;
  font_size?: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TITLE = "Guru Mata Pelajaran";

// localStorage key for extended config (columns that may not exist in DB yet)
const EXTENDED_CONFIG_KEY = "sipena_signature_extended";

function getExtendedConfig(userId: string): Partial<SignatureSettingsConfig> {
  try {
    const raw = localStorage.getItem(`${EXTENDED_CONFIG_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveExtendedConfig(userId: string, config: Partial<SignatureSettingsConfig>) {
  try {
    localStorage.setItem(`${EXTENDED_CONFIG_KEY}_${userId}`, JSON.stringify(config));
  } catch { /* ignore */ }
}

export function createEmptySignatureSigner(): SignatureSigner {
  return {
    id: (globalThis.crypto?.randomUUID?.() || `signer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    name: "",
    title: DEFAULT_TITLE,
    nip: "",
    school_name: "",
  };
}

export function createDefaultSignatureConfig(): SignatureSettingsConfig {
  return {
    city: "",
    signers: [createEmptySignatureSigner()],
    useCustomDate: false,
    customDate: null,
    fontSize: 10,
    showSignatureLine: true,
    signatureLinePosition: 'above-name',
    signatureLineLengthMode: 'fixed',
    signatureLineWidth: 50,
    signatureSpacing: 20,
    signatureAlignment: 'right',
    signatureOffsetX: 0,
    signatureOffsetY: 0,
    placementMode: 'adaptive',
    signaturePreset: 'bottom-right',
    manualXPercent: null,
    manualYPercent: null,
    snapToGrid: true,
    gridSizeMm: 5,
    lockSignaturePosition: false,
    showDebugGuides: false,
    signaturePageIndex: null,
  };
}

function normalizeSigners(rawSigners: unknown, legacy?: Partial<SignatureSettings>): SignatureSigner[] {
  if (Array.isArray(rawSigners) && rawSigners.length > 0) {
    const mapped = rawSigners
      .filter((item) => !!item && typeof item === "object")
      .map((item: any, index) => ({
        id: item.id || createEmptySignatureSigner().id,
        name: item.name || "",
        title: item.title || DEFAULT_TITLE,
        nip: item.nip || "",
        school_name: item.school_name || "",
        order_index: Number.isFinite(item.order_index) ? item.order_index : index,
      }))
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    if (mapped.length > 0) return mapped;
  }

  if (legacy?.name || legacy?.title || legacy?.nip || legacy?.school_name) {
    return [{
      id: createEmptySignatureSigner().id,
      name: legacy.name || "",
      title: legacy.title || DEFAULT_TITLE,
      nip: legacy.nip || "",
      school_name: legacy.school_name || "",
      order_index: 0,
    }];
  }

  return [createEmptySignatureSigner()];
}

function normalizeConfig(input: Partial<SignatureSettingsConfig> & Partial<SignatureSettings>, extendedOverrides?: Partial<SignatureSettingsConfig>): SignatureSettingsConfig {
  const signers = normalizeSigners(input.signers ?? extendedOverrides?.signers, input);

  return {
    city: input.city || "",
    signers,
    useCustomDate: Boolean((input as any).useCustomDate ?? (input as any).use_custom_date ?? extendedOverrides?.useCustomDate),
    customDate: (input as any).customDate ?? (input as any).custom_date ?? extendedOverrides?.customDate ?? null,
    fontSize: Math.max(1, Number((input as any).fontSize ?? (input as any).font_size ?? extendedOverrides?.fontSize ?? 10) || 10),
    showSignatureLine: (input as any).showSignatureLine ?? extendedOverrides?.showSignatureLine ?? true,
    signatureLinePosition: ((input as any).signatureLinePosition ?? extendedOverrides?.signatureLinePosition ?? 'above-name') as SignatureLinePosition,
    signatureLineLengthMode: ((input as any).signatureLineLengthMode ?? extendedOverrides?.signatureLineLengthMode ?? 'fixed') as SignatureLineLengthMode,
    signatureLineWidth: Number((input as any).signatureLineWidth ?? extendedOverrides?.signatureLineWidth ?? 50) || 50,
    signatureSpacing: Number((input as any).signatureSpacing ?? extendedOverrides?.signatureSpacing ?? 20) || 20,
    signatureAlignment: ((input as any).signatureAlignment ?? extendedOverrides?.signatureAlignment ?? 'right') as SignatureAlignment,
    signatureOffsetX: Number((input as any).signatureOffsetX ?? extendedOverrides?.signatureOffsetX ?? 0) || 0,
    signatureOffsetY: Number((input as any).signatureOffsetY ?? extendedOverrides?.signatureOffsetY ?? 0) || 0,
    placementMode: ((input as any).placementMode ?? extendedOverrides?.placementMode ?? 'adaptive') as SignaturePlacementMode,
    signaturePreset: ((input as any).signaturePreset ?? extendedOverrides?.signaturePreset ?? 'bottom-right') as SignaturePreset,
    manualXPercent: typeof ((input as any).manualXPercent ?? extendedOverrides?.manualXPercent) === "number"
      ? Number((input as any).manualXPercent ?? extendedOverrides?.manualXPercent)
      : null,
    manualYPercent: typeof ((input as any).manualYPercent ?? extendedOverrides?.manualYPercent) === "number"
      ? Number((input as any).manualYPercent ?? extendedOverrides?.manualYPercent)
      : null,
    snapToGrid: Boolean((input as any).snapToGrid ?? extendedOverrides?.snapToGrid ?? true),
    gridSizeMm: Number((input as any).gridSizeMm ?? extendedOverrides?.gridSizeMm ?? 5) || 5,
    lockSignaturePosition: Boolean((input as any).lockSignaturePosition ?? extendedOverrides?.lockSignaturePosition ?? false),
    showDebugGuides: Boolean((input as any).showDebugGuides ?? extendedOverrides?.showDebugGuides ?? false),
    signaturePageIndex: typeof ((input as any).signaturePageIndex ?? extendedOverrides?.signaturePageIndex) === "number"
      ? Number((input as any).signaturePageIndex ?? extendedOverrides?.signaturePageIndex)
      : null,
  };
}

export function hasValidSignatureConfig(config: SignatureSettingsConfig | null | undefined): boolean {
  if (!config) return false;
  if (!config.city.trim()) return false;
  return config.signers.some((s) => s.name.trim());
}

export function formatSignatureDisplayDate(date?: string | null): string {
  const selected = date ? new Date(date) : new Date();
  return selected.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function useSignatureSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: signatureRow, isLoading } = useQuery({
    queryKey: ["signature_settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await (supabase as any)
        .from("signature_settings")
        .select("id, user_id, city, name, title, nip, school_name, created_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.warn("[SignatureSettings] Query error:", error.message);
        return null;
      }
      return data as SignatureSettings | null;
    },
    enabled: !!user?.id,
    retry: false,
  });

  // Merge DB data with localStorage extended config
  const extendedConfig = user?.id ? getExtendedConfig(user.id) : {};
  const signatureConfig = signatureRow
    ? normalizeConfig(signatureRow as any, extendedConfig)
    : (Object.keys(extendedConfig).length > 0 ? normalizeConfig({}, extendedConfig) : createDefaultSignatureConfig());

  const saveMutation = useMutation({
    mutationFn: async (settings: Partial<SignatureSettingsConfig> & Partial<SignatureSettings>) => {
      if (!user?.id) throw new Error("Not authenticated");

      const normalized = normalizeConfig(settings as any);
      const primarySigner = normalized.signers[0] || {
        name: "",
        title: DEFAULT_TITLE,
        nip: "",
        school_name: "",
      };

      // Save base columns to DB (always works)
      const basePayload = {
        user_id: user.id,
        city: normalized.city || "",
        name: primarySigner.name,
        title: primarySigner.title,
        nip: primarySigner.nip,
        school_name: primarySigner.school_name,
        updated_at: new Date().toISOString(),
      };

      // Save extended config to localStorage (signers array, custom date, font, line options)
      const extConfig: Partial<SignatureSettingsConfig> = {
        signers: normalized.signers.map((s, i) => ({ ...s, order_index: i })),
        useCustomDate: normalized.useCustomDate,
        customDate: normalized.useCustomDate ? normalized.customDate : null,
        fontSize: normalized.fontSize,
        showSignatureLine: normalized.showSignatureLine,
        signatureLinePosition: normalized.signatureLinePosition,
        signatureLineLengthMode: normalized.signatureLineLengthMode,
        signatureLineWidth: normalized.signatureLineWidth,
        signatureSpacing: normalized.signatureSpacing,
        signatureAlignment: normalized.signatureAlignment,
        signatureOffsetX: normalized.signatureOffsetX,
        signatureOffsetY: normalized.signatureOffsetY,
        placementMode: normalized.placementMode,
        signaturePreset: normalized.signaturePreset,
        manualXPercent: normalized.manualXPercent,
        manualYPercent: normalized.manualYPercent,
        snapToGrid: normalized.snapToGrid,
        gridSizeMm: normalized.gridSizeMm,
        lockSignaturePosition: normalized.lockSignaturePosition,
        showDebugGuides: normalized.showDebugGuides,
        signaturePageIndex: normalized.signaturePageIndex,
      };
      saveExtendedConfig(user.id, extConfig);

      if (signatureRow?.id) {
        const { data, error } = await (supabase as any)
          .from("signature_settings")
          .update(basePayload)
          .eq("id", signatureRow.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await (supabase as any)
        .from("signature_settings")
        .insert(basePayload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature_settings", user?.id] });
    },
  });

  const firstSigner = signatureConfig.signers[0] || createEmptySignatureSigner();
  const signature = {
    ...(signatureRow || {}),
    city: signatureConfig.city,
    name: firstSigner.name,
    title: firstSigner.title,
    nip: firstSigner.nip,
    school_name: firstSigner.school_name,
  } as SignatureSettings;

  return {
    signature,
    signatureConfig,
    isLoading,
    saveSignature: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    hasSignature: hasValidSignatureConfig(signatureConfig),
  };
}
