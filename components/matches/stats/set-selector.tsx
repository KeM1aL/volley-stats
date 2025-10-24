"use client";

import { Button } from "@/components/ui/button";
import { Set } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SetSelectorProps {
  sets: Set[];
  selectedSetId: string | null;
  onSelectSet: (setId: string | null) => void;
}

export function SetSelector({ sets, selectedSetId, onSelectSet }: SetSelectorProps) {
  return (
    <div className="inline-flex">
        <Button
          variant={selectedSetId === null ? "default" : "outline"}
          onClick={() => onSelectSet(null)}
          className="rounded-r-none"
          id="set-selector-all"
        >
          All Sets
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
            Set {set.set_number}
          </Button>
        ))}
      </div>
  );
}
