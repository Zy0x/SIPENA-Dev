import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, AlertCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

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

interface FormulaSettingsProps {
  formula: CustomFormula;
  onFormulaChange: (formula: CustomFormula) => void;
  hasChapters: boolean;
}

export function FormulaSettings({ formula, onFormulaChange, hasChapters }: FormulaSettingsProps) {
  const totalWeight = formula.components
    .filter(c => c.enabled)
    .reduce((sum, c) => sum + c.weight, 0);

  const updateComponentWeight = (componentId: string, weight: number) => {
    onFormulaChange({
      ...formula,
      components: formula.components.map((c) =>
        c.id === componentId ? { ...c, weight } : c
      ),
    });
  };

  const toggleComponent = (componentId: string) => {
    onFormulaChange({
      ...formula,
      components: formula.components.map((c) =>
        c.id === componentId ? { ...c, enabled: !c.enabled } : c
      ),
    });
  };

  const getFormulaDescription = () => {
    if (!formula.enabled) {
      if (!hasChapters) {
        return "(STS + SAS) / 2";
      }
      return "(Rata-rata BAB + (STS + SAS) / 2) / 2";
    }
    
    const enabledComponents = formula.components.filter(c => c.enabled);
    if (enabledComponents.length === 0) return "Tidak ada komponen dipilih";
    
    return enabledComponents
      .map(c => `${c.name} × ${c.weight}%`)
      .join(" + ");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calculator className="w-4 h-4" />
          Rumus
          {formula.enabled && (
            <Badge variant="secondary" className="ml-1 text-xs">
              Kustom
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Pengaturan Rumus</h4>
              <p className="text-xs text-muted-foreground">
                Sesuaikan perhitungan nilai rapor
              </p>
            </div>
          </div>

          {/* Toggle Custom Formula */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="font-medium">Rumus Kustom</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Atur bobot masing-masing komponen
              </p>
            </div>
            <Switch
              checked={formula.enabled}
              onCheckedChange={(checked) =>
                onFormulaChange({ ...formula, enabled: checked })
              }
            />
          </div>

          {/* Formula Components */}
          {formula.enabled && (
            <div className="space-y-3">
              {formula.components.map((component) => (
                <div
                  key={component.id}
                  className={`p-3 rounded-lg border ${
                    component.enabled ? "bg-background" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Label
                      className={`font-medium ${
                        !component.enabled ? "text-muted-foreground" : ""
                      }`}
                    >
                      {component.name}
                    </Label>
                    <Switch
                      checked={component.enabled}
                      onCheckedChange={() => toggleComponent(component.id)}
                    />
                  </div>

                  {component.enabled && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Bobot</span>
                        <span className="font-medium">{component.weight}%</span>
                      </div>
                      <Slider
                        value={[component.weight]}
                        onValueChange={([value]) =>
                          updateComponentWeight(component.id, value)
                        }
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Total Weight Indicator */}
              <div
                className={`flex items-center justify-between p-3 rounded-lg ${
                  totalWeight === 100
                    ? "bg-grade-pass/10 text-grade-pass"
                    : "bg-grade-warning/10 text-grade-warning"
                }`}
              >
                <span className="text-sm font-medium">Total Bobot</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{totalWeight}%</span>
                  {totalWeight !== 100 && (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>
              </div>

              {totalWeight !== 100 && (
                <p className="text-xs text-grade-warning">
                  Total bobot akan dinormalisasi menjadi 100%
                </p>
              )}
            </div>
          )}

          {/* Current Formula Display */}
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Rumus saat ini:</p>
              <p className="text-sm font-mono">{getFormulaDescription()}</p>
            </CardContent>
          </Card>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Calculate report grade with formula
export function calculateReportGrade(
  formula: CustomFormula,
  grandAvg: number,
  sts: number,
  sas: number,
  hasChapters: boolean
): number {
  if (formula.enabled) {
    const enabledComponents = formula.components.filter(c => c.enabled);
    const totalWeight = enabledComponents.reduce((sum, c) => sum + c.weight, 0);
    
    if (totalWeight === 0) return 0;
    
    let result = 0;
    enabledComponents.forEach((component) => {
      const normalizedWeight = component.weight / totalWeight;
      switch (component.id) {
        case "grandAvg":
          result += grandAvg * normalizedWeight;
          break;
        case "sts":
          result += sts * normalizedWeight;
          break;
        case "sas":
          result += sas * normalizedWeight;
          break;
      }
    });
    
    return result;
  }
  
  // Default formula
  const stsSasAvg = (sts + sas) / 2;
  
  if (!hasChapters) {
    return stsSasAvg;
  }
  
  return (grandAvg + stsSasAvg) / 2;
}
