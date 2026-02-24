"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Check, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PdfGenerationStep {
  id: string;
  label: string;
  status: "pending" | "in-progress" | "completed";
}

interface PdfLoadingOverlayProps {
  isVisible: boolean;
  steps: PdfGenerationStep[];
  currentStepIndex: number;
  onCancel: () => void;
}

export function PdfLoadingOverlay({
  isVisible,
  steps,
  currentStepIndex,
  onCancel,
}: PdfLoadingOverlayProps) {
  const t = useTranslations("common.ui");

  if (!isVisible) return null;

  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-lg font-semibold">{t("generatingPdfReport")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("pleaseWaitWhileCompiling")}
            </p>
          </div>

          {/* Progress Bar */}
          <Progress value={progress} className="h-2" />

          {/* Steps List */}
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                  step.status === "in-progress" && "bg-primary/10",
                  step.status === "completed" && "opacity-60"
                )}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {step.status === "completed" ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : step.status === "in-progress" ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={cn(
                    "text-sm",
                    step.status === "in-progress" && "font-medium",
                    step.status === "pending" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress Text and Cancel Button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("step")} {currentStepIndex + 1} {t("of")} {steps.length}
            </p>
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              {t("cancel")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
