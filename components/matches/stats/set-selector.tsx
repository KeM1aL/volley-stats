"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Set } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SetSelectorProps {
  sets: Set[];
  selectedSetId: string | null;
  onSelectSet: (setId: string | null) => void;
}

export function SetSelector({ sets, selectedSetId, onSelectSet }: SetSelectorProps) {
  const t = useTranslations("matches");
  return (
    <div className="inline-flex pdf-hide">
        <Button
          variant={selectedSetId === null ? "default" : "outline"}
          onClick={() => onSelectSet(null)}
          className="rounded-r-none"
          id="set-selector-all"
        >
          {t("stats.allSetsOverview")}
        </Button>
        {sets.map((set, index) => (
          <Button
            variant={selectedSetId === set.id ? "default" : "outline"}
            key={set.id}
            id={`set-selector-${set.id}`}
            onClick={() => onSelectSet(set.id)}
            className={`
                        ${index === sets.length - 1 ? "rounded-l-none" : ""}
                        ${
                          index >= 0 && index < sets.length - 1
                            ? "rounded-none border-x-0"
                            : ""
                        }
                      `}
          >
            {t("stats.setLabel")} {set.set_number}
          </Button>
        ))}
      </div>
  );
}
