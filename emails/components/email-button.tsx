import { Button } from "@react-email/components";
import * as React from "react";

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export const EmailButton = ({ href, children }: EmailButtonProps) => {
  return (
    <Button href={href} style={button}>
      {children}
    </Button>
  );
};

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "14px 28px",
  margin: "24px 0",
};

export default EmailButton;
