import { Heading, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export const MagicLinkEmail = () => {
  return (
    <EmailLayout preview="Your VolleyStats sign-in link is ready!">
      <Heading style={heading}>Hey! Let's get you signed in 👋</Heading>

      <Text style={paragraph}>
        Click the button below to sign in to VolleyStats. This link will work for the next hour.
      </Text>

      <EmailButton href="&#123;&#123;.ConfirmationURL&#125;&#125;">
        Sign In to VolleyStats
      </EmailButton>

      <Text style={linkParagraph}>
        Or copy and paste this link into your browser:{" "}
        <Link href="&#123;&#123;.ConfirmationURL&#125;&#125;" style={link}>
          &#123;&#123;.ConfirmationURL&#125;&#125;
        </Link>
      </Text>

      <Text style={warningText}>
        ⚠️ <strong>Security note:</strong> This link is unique to you. Don't share it with anyone! It expires in 1 hour.
      </Text>

      <Text style={paragraph}>
        If you didn't request this sign-in link, you can safely ignore this email.
      </Text>

      <Text style={signature}>
        Happy tracking!<br />
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

export default MagicLinkEmail;
