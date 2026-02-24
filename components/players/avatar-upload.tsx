"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadAvatar, deleteAvatar } from "@/lib/supabase/storage";

interface AvatarUploadProps {
  playerId?: string;
  currentAvatar?: string | null;
  onAvatarChange: (url: string | null) => void;
  className?: string;
}

export function AvatarUpload({
  playerId,
  currentAvatar,
  onAvatarChange,
  className,
}: AvatarUploadProps) {
  const t = useTranslations("players");
  const tCommon = useTranslations("common");
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatar || null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !playerId) return;

    setIsUploading(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      const publicUrl = await uploadAvatar(file, playerId);
      onAvatarChange(publicUrl);
    } catch (error) {
      console.error('Upload failed:', error);
      setPreviewUrl(currentAvatar || null);
    } finally {
      setIsUploading(false);
    }
  }, [playerId, currentAvatar, onAvatarChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleRemove = async () => {
    if (!playerId) return;

    setIsUploading(true);
    try {
      await deleteAvatar(playerId);
      setPreviewUrl(null);
      onAvatarChange(null);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          isUploading && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t("form.uploading")}</p>
          </div>
        ) : previewUrl ? (
          <div className="relative aspect-square w-32 mx-auto">
            <Image
              src={previewUrl}
              alt={tCommon("ui.avatarPreview")}
              fill
              className="rounded-lg object-cover"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Drag & drop an image here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG up to 5MB
            </p>
          </div>
        )}
      </div>

      {previewUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleRemove}
          disabled={isUploading}
        >
          <X className="h-4 w-4 mr-2" />
          Remove Image
        </Button>
      )}
    </div>
  );
}