export interface FormulaComponent {
  id: string;
  name: string;
  enabled: boolean;
  weight: number;
}

export type ReportRoundingMode =
  | "default"
  | "nearest_integer"
  | "floor_integer"
  | "ceil_integer"
  | "one_decimal";

export interface ReportRoundingSetting {
  mode: ReportRoundingMode;
}

export interface CustomFormula {
  enabled: boolean;
  components: FormulaComponent[];
  reportRounding: ReportRoundingSetting;
}

export const DEFAULT_FORMULA: CustomFormula = {
  enabled: false,
  reportRounding: { mode: "default" },
  components: [
    { id: "grandAvg", name: "Rata-rata BAB", enabled: true, weight: 50 },
    { id: "sts", name: "Nilai STS", enabled: true, weight: 25 },
    { id: "sas", name: "Nilai SAS", enabled: true, weight: 25 },
  ],
};

const FORMULA_COMPONENT_IDS = new Set(DEFAULT_FORMULA.components.map((component) => component.id));
const REPORT_ROUNDING_MODES = new Set<ReportRoundingMode>([
  "default",
  "nearest_integer",
  "floor_integer",
  "ceil_integer",
  "one_decimal",
]);

export function normalizeReportRounding(raw: unknown): ReportRoundingSetting {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_FORMULA.reportRounding;
  }

  const input = raw as Partial<ReportRoundingSetting>;
  return {
    mode: input.mode && REPORT_ROUNDING_MODES.has(input.mode) ? input.mode : DEFAULT_FORMULA.reportRounding.mode,
  };
}

export function getReportRoundingLabel(mode: ReportRoundingMode): string {
  switch (mode) {
    case "one_decimal":
      return "Satu desimal";
    case "nearest_integer":
      return "Bulat terdekat";
    case "floor_integer":
      return "Bulat ke bawah";
    case "ceil_integer":
      return "Bulat ke atas";
    case "default":
    default:
      return "Default";
  }
}

export function normalizeFormula(raw: unknown): CustomFormula {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_FORMULA;
  }

  const input = raw as Partial<CustomFormula>;
  const rawComponents = Array.isArray(input.components) ? input.components : [];
  const componentsById = new Map(
    rawComponents
      .filter((component): component is FormulaComponent => {
        return (
          !!component &&
          typeof component === "object" &&
          typeof component.id === "string" &&
          FORMULA_COMPONENT_IDS.has(component.id)
        );
      })
      .map((component) => [
        component.id,
        {
          ...component,
          name: component.name || DEFAULT_FORMULA.components.find((item) => item.id === component.id)?.name || component.id,
          enabled: Boolean(component.enabled),
          weight: Number.isFinite(Number(component.weight)) ? Math.max(0, Number(component.weight)) : 0,
        },
      ]),
  );

  return {
    enabled: Boolean(input.enabled),
    reportRounding: normalizeReportRounding(input.reportRounding),
    components: DEFAULT_FORMULA.components.map((defaultComponent) => ({
      ...defaultComponent,
      ...(componentsById.get(defaultComponent.id) || {}),
    })),
  };
}

export function applyReportGradeRounding(value: number, rounding: ReportRoundingSetting = DEFAULT_FORMULA.reportRounding): number {
  const normalized = normalizeReportRounding(rounding);
  switch (normalized.mode) {
    case "nearest_integer":
      return Math.round(value);
    case "floor_integer":
      return Math.floor(value);
    case "ceil_integer":
      return Math.ceil(value);
    case "one_decimal":
      return Math.round(value * 10) / 10;
    case "default":
    default:
      return value;
  }
}

export function calculateReportGrade(
  formula: CustomFormula,
  grandAvg: number,
  sts: number,
  sas: number,
  hasChapters: boolean,
): number {
  const normalizedFormula = normalizeFormula(formula);

  if (normalizedFormula.enabled) {
    const enabledComponents = normalizedFormula.components.filter((component) => component.enabled);
    const totalWeight = enabledComponents.reduce((sum, component) => sum + component.weight, 0);

    if (totalWeight === 0) return 0;

    const weightedGrade = enabledComponents.reduce((result, component) => {
      const normalizedWeight = component.weight / totalWeight;
      switch (component.id) {
        case "grandAvg":
          return result + grandAvg * normalizedWeight;
        case "sts":
          return result + sts * normalizedWeight;
        case "sas":
          return result + sas * normalizedWeight;
        default:
          return result;
      }
    }, 0);

    return applyReportGradeRounding(weightedGrade, normalizedFormula.reportRounding);
  }

  const stsSasAvg = (sts + sas) / 2;

  if (!hasChapters) {
    return applyReportGradeRounding(stsSasAvg, normalizedFormula.reportRounding);
  }

  return applyReportGradeRounding((grandAvg + stsSasAvg) / 2, normalizedFormula.reportRounding);
}
