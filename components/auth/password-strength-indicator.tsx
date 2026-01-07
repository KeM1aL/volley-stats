import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export type PasswordStrength = "weak" | "medium" | "strong";

export function calculatePasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
} {
  let score = 0;

  if (!password) {
    return { strength: "weak", score: 0 };
  }

  // Length check
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety checks
  if (/[a-z]/.test(password)) score += 15; // lowercase
  if (/[A-Z]/.test(password)) score += 15; // uppercase
  if (/[0-9]/.test(password)) score += 15; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 15; // special characters

  // Determine strength
  let strength: PasswordStrength;
  if (score < 40) {
    strength = "weak";
  } else if (score < 70) {
    strength = "medium";
  } else {
    strength = "strong";
  }

  return { strength, score };
}

export function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  const { strength, score } = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );

  if (!password) return null;

  const strengthColor = {
    weak: "text-red-600",
    medium: "text-yellow-600",
    strong: "text-green-600",
  }[strength];

  const strengthLabel = {
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
  }[strength];

  return (
    <div className="space-y-2">
      <Progress value={score} className="h-2" />
      <p className={`text-sm font-medium ${strengthColor}`}>
        Password strength: {strengthLabel}
      </p>
      {strength === "weak" && (
        <p className="text-xs text-muted-foreground">
          Use at least 8 characters with a mix of uppercase, lowercase, numbers,
          and special characters.
        </p>
      )}
    </div>
  );
}
