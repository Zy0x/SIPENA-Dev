export interface FormulaComponent {
  id: string;
  name: string;
  enabled: boolean;
  weight: number;
}

export interface CustomFormula {
  enabled: boolean;
  components: FormulaComponent[];
}

export const DEFAULT_FORMULA: CustomFormula = {
  enabled: false,
  components: [
    { id: "grandAvg", name: "Rata-rata BAB", enabled: true, weight: 50 },
    { id: "sts", name: "Nilai STS", enabled: true, weight: 25 },
    { id: "sas", name: "Nilai SAS", enabled: true, weight: 25 },
  ],
};

const FORMULA_COMPONENT_IDS = new Set(DEFAULT_FORMULA.components.map((component) => component.id));

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
    components: DEFAULT_FORMULA.components.map((defaultComponent) => ({
      ...defaultComponent,
      ...(componentsById.get(defaultComponent.id) || {}),
    })),
  };
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

    return enabledComponents.reduce((result, component) => {
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
  }

  const stsSasAvg = (sts + sas) / 2;

  if (!hasChapters) {
    return stsSasAvg;
  }

  return (grandAvg + stsSasAvg) / 2;
}
