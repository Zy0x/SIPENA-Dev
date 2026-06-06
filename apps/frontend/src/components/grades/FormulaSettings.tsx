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
import { cn } from "@/lib/utils";
export {
  DEFAULT_FORMULA,
  calculateReportGrade,
  type CustomFormula,
  type FormulaComponent,
} from "@/lib/gradeFormula";
import type { CustomFormula } from "@/lib/gradeFormula";

interface FormulaSettingsProps {
  formula: CustomFormula;
  onFormulaChange: (formula: CustomFormula) => void;
  hasChapters: boolean;
  triggerClassName?: string;
}
export function FormulaSettings({ formula, onFormulaChange, hasChapters, triggerClassName }: FormulaSettingsProps) {
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
        <Button variant="outline" size="sm" className={cn("gap-2", triggerClassName)}>
          <Calculator className="w-4 h-4" />
          <span className="sipena-grade-action-text">Rumus</span>
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
