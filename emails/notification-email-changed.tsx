import { Heading, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/email-layout";

export const NotificationEmailChangedEmail = () => {
  return (
    <EmailLayout preview="Your VolleyStats email address was updated">
      <Heading style={heading}>Your email address was updated ✉️</Heading>

      <Text style={paragraph}>
        This is a confirmation that the email address for your VolleyStats account has been successfully changed.
      </Text>

      <Text style={paragraph}>
        If you made this change, no further action is required. Future emails from VolleyStats will be sent to your new address.
      </Text>

      <Text style={warningText}>
        ⚠️ <strong>Didn&apos;t make this change?</strong> Please contact our support team immediately at{" "}
        <a href="mailto:volleystats@blockservice.fr" style={warningLink}>
          volleystats@blockservice.fr
        </a>
        . We&apos;ll help you recover access to your account.
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

export default NotificationEmailChangedEmail;
