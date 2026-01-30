"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MatchFormatForm } from "./match-format-form";
import { MatchFormat } from "@/lib/types";
import { useTranslations } from "next-intl";

type NewMatchFormatDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (matchFormat: MatchFormat) => void;
};

export function NewMatchFormatDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewMatchFormatDialogProps) {
  const t = useTranslations("match-formats");

  const handleSuccess = (matchFormat: MatchFormat) => {
    onOpenChange(false);
    if (onSuccess) {
      onSuccess(matchFormat);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("dialog.newMatchFormat")}</DialogTitle>
        </DialogHeader>
        <MatchFormatForm
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
