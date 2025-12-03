import { Heading, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export const ResetPasswordEmail = () => {
  return (
    <EmailLayout preview="Reset your VolleyStats password">
      <Heading style={heading}>Hey! Need to reset your password? 🔒</Heading>

      <Text style={paragraph}>
        We received a request to reset your password for your VolleyStats account. No worries, it happens!
      </Text>

      <Text style={paragraph}>
        Click the button below to set a new password:
      </Text>

      <EmailButton href="&#123;&#123;.ConfirmationURL&#125;&#125;">
        Reset Password
      </EmailButton>

      <Text style={linkParagraph}>
        Or copy and paste this link into your browser:{" "}
        <Link href="&#123;&#123;.ConfirmationURL&#125;&#125;" style={link}>
          &#123;&#123;.ConfirmationURL&#125;&#125;
        </Link>
      </Text>

      <Text style={warningText}>
        ⏰ <strong>Time sensitive:</strong> This link expires in 1 hour for security purposes. If it expires, just request a new one.
      </Text>

      <Text style={paragraph}>
        If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
      </Text>

      <Text style={tipText}>
        💡 <strong>Pro tip:</strong> Use a strong, unique password that you don't use anywhere else!
      </Text>

      <Text style={signature}>
        Stay secure!<br />
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

const tipText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  backgroundColor: "#f0fdf4",
  padding: "16px",
  borderRadius: "8px",
  margin: "24px 0",
  border: "1px solid #d1fae5",
};

const signature = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "32px 0 0",
};

export default ResetPasswordEmail;
