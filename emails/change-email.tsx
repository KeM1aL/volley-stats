import { Heading, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export const ChangeEmailEmail = () => {
  return (
    <EmailLayout preview="Confirm your new email address for VolleyStats">
      <Heading style={heading}>Hey! Just checking it's really you 👋</Heading>

      <Text style={paragraph}>
        You (or someone) requested to change your VolleyStats email address to <strong>&#123;&#123;.Email&#125;&#125;</strong>.
      </Text>

      <Text style={paragraph}>
        To confirm this change, click the button below:
      </Text>

      <EmailButton href="&#123;&#123;.ConfirmationURL&#125;&#125;">
        Confirm New Email
      </EmailButton>

      <Text style={linkParagraph}>
        Or copy and paste this link into your browser:{" "}
        <Link href="&#123;&#123;.ConfirmationURL&#125;&#125;" style={link}>
          &#123;&#123;.ConfirmationURL&#125;&#125;
        </Link>
      </Text>

      <Text style={infoText}>
        ℹ️ <strong>What happens next:</strong> Once you confirm, your old email address will no longer work for signing in to VolleyStats.
      </Text>

      <Text style={paragraph}>
        If you didn't request this email address change, you can safely ignore this email. Your account will remain unchanged.
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

const infoText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  backgroundColor: "#dbeafe",
  padding: "16px",
  borderRadius: "8px",
  margin: "24px 0",
  border: "1px solid #bfdbfe",
};

const signature = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "32px 0 0",
};

export default ChangeEmailEmail;
