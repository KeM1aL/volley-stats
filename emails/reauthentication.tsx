import { Heading, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export const ReauthenticationEmail = () => {
  return (
    <EmailLayout preview="Confirm it's you — VolleyStats security check">
      <Heading style={heading}>Hey! Let&apos;s confirm it&apos;s really you 🔐</Heading>

      <Text style={paragraph}>
        A request was made to perform a sensitive action on your VolleyStats account. To continue, please verify your identity by clicking the button below.
      </Text>

      <EmailButton href="{{.ConfirmationURL}}">
        Confirm It&apos;s Me
      </EmailButton>

      <Text style={linkParagraph}>
        Or copy and paste this link into your browser:{" "}
        <Link href="{{.ConfirmationURL}}" style={link}>
          {{.ConfirmationURL}}
        </Link>
      </Text>

      <Text style={warningText}>
        ⚠️ <strong>Time sensitive:</strong> This link expires in 10 minutes. If it expires, you&apos;ll need to restart the action that triggered this email.
      </Text>

      <Text style={paragraph}>
        If you didn&apos;t request this, your account may be at risk — consider changing your password immediately.
      </Text>

      <Text style={signature}>
        Stay secure!
        <br />
        The VolleyStats Team
      </Text>
    </EmailLayout>
  );
};

// Styles
const heading = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#0f172a",
  margin: "0 0 24px",
  lineHeight: "1.3",
};
const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "16px 0",
};
const linkParagraph = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#737373",
  margin: "24px 0",
};
const link = {
  color: "#0f172a",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};
const warningText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  backgroundColor: "#fef3c7",
  padding: "16px",
  borderRadius: "8px",
  margin: "24px 0",
  border: "1px solid #fde68a",
};
const signature = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "32px 0 0",
};

export default ReauthenticationEmail;
