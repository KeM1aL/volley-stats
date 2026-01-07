import { Heading, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export const InviteEmail = () => {
  return (
    <EmailLayout preview="You've been invited to join VolleyStats!">
      <Heading style={heading}>Hey! Good news 🎉</Heading>

      <Text style={paragraph}>
        You've been invited to join a team on VolleyStats, the simple volleyball statistics tracking platform!
      </Text>

      <Text style={paragraph}>
        VolleyStats makes it easy to:
      </Text>

      <ul style={list}>
        <li style={listItem}>Track live match statistics in real-time</li>
        <li style={listItem}>Analyze player and team performance</li>
        <li style={listItem}>Access data offline and sync automatically</li>
        <li style={listItem}>Collaborate with your entire team</li>
      </ul>

      <Text style={paragraph}>
        Click the button below to accept the invitation and create your account:
      </Text>

      <EmailButton href="&#123;&#123;.ConfirmationURL&#125;&#125;">
        Accept Invitation
      </EmailButton>

      <Text style={linkParagraph}>
        Or copy and paste this link into your browser:{" "}
        <Link href="&#123;&#123;.ConfirmationURL&#125;&#125;" style={link}>
          &#123;&#123;.ConfirmationURL&#125;&#125;
        </Link>
      </Text>

      <Text style={paragraph}>
        If you didn't expect this invitation or don't want to join, you can safely ignore this email.
      </Text>

      <Text style={signature}>
        See you on the court!<br />
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

const list = {
  margin: "16px 0",
  paddingLeft: "20px",
};

const listItem = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "8px 0",
};

const signature = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "32px 0 0",
};

export default InviteEmail;
