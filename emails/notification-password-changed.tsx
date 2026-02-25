import { Heading, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/email-layout";

export const NotificationPasswordChangedEmail = () => {
  return (
    <EmailLayout preview="Your VolleyStats password was changed">
      <Heading style={heading}>Your password was changed 🔒</Heading>

      <Text style={paragraph}>
        This is a confirmation that the password for your VolleyStats account was recently changed.
      </Text>

      <Text style={paragraph}>
        If you made this change, no further action is required.
      </Text>

      <Text style={warningText}>
        ⚠️ <strong>Didn&apos;t make this change?</strong> Please reset your password immediately and contact our support team at{" "}
        <a href="mailto:volleystats@blockservice.fr" style={warningLink}>
          volleystats@blockservice.fr
        </a>
        . Act quickly to secure your account.
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
const warningLink = {
  color: "#0f172a",
  textDecoration: "underline",
};
const signature = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "32px 0 0",
};

export default NotificationPasswordChangedEmail;
