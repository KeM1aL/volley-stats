import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, RotateCw, FlipHorizontal } from "lucide-react";

interface CourtControlsProps {
  onRotateClockwise: () => void;
  onRotateCounterClockwise: () => void;
  onFlipCourt: () => void;
}

export function CourtControls({
  onRotateClockwise,
  onRotateCounterClockwise,
  onFlipCourt,
}: CourtControlsProps) {
  return (
    <Card className="p-4 flex gap-4 justify-center">
      <Button
        variant="outline"
        size="icon"
        onClick={onRotateCounterClockwise}
        title="Rotate Counter-Clockwise"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onFlipCourt}
        title="Flip Court"
      >
        <FlipHorizontal className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onRotateClockwise}
        title="Rotate Clockwise"
      >
        <RotateCw className="h-4 w-4" />
      </Button>
    </Card>
  );
}