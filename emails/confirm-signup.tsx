import { Heading, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export const ConfirmSignupEmail = () => {
  return (
    <EmailLayout preview="Welcome to VolleyStats! Confirm your email to get started.">
      <Heading style={heading}>Hey there! Welcome to the team 🎉</Heading>

      <Text style={paragraph}>
        We're excited to have you join VolleyStats! We're here to help you track, analyze, and improve your volleyball team's performance with simple analytics.
      </Text>

      <Text style={paragraph}>
        To get started, please confirm your email address by clicking the button below:
      </Text>

      <EmailButton href="&#123;&#123;.ConfirmationURL&#125;&#125;">
        Confirm Email Address
      </EmailButton>

      <Text style={linkParagraph}>
        Or copy and paste this link into your browser:{" "}
        <Link href="&#123;&#123;.ConfirmationURL&#125;&#125;" style={link}>
          &#123;&#123;.ConfirmationURL&#125;&#125;
        </Link>
      </Text>

      <Text style={paragraph}>
        Once confirmed, you'll be able to:
      </Text>

      <ul style={list}>
        <li style={listItem}>Create and manage your teams</li>
        <li style={listItem}>Track live match statistics</li>
        <li style={listItem}>Analyze player and team performance</li>
        <li style={listItem}>Work offline and sync when ready</li>
      </ul>

      <Text style={paragraph}>
        If you didn't create an account with VolleyStats, you can safely ignore this email.
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

export default ConfirmSignupEmail;
