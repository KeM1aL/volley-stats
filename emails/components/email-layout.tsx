import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
} from "@react-email/components";
import * as React from "react";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export const EmailLayout = ({ preview, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={header}>
            <Img
              src="&#123;&#123;.SiteURL&#125;&#125;/logo.png"
              width="50"
              height="50"
              alt="VolleyStats"
              style={logo}
            />
          </Section>

          {/* Main Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <EmailFooter />
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const EmailFooter = () => {
  return (
    <>
      <div style={footerText}>
        <p style={footerParagraph}>
          Questions? Contact us at{" "}
          <a href="mailto:volleystats@blockservice.fr" style={link}>
            volleystats@blockservice.fr
          </a>
        </p>
        <p style={footerParagraph}>
          <a href="https://twitter.com/volleystats" style={socialLink}>
            Twitter
          </a>{" "}
          •{" "}
          <a href="https://instagram.com/volleystats" style={socialLink}>
            Instagram
          </a>{" "}
          •{" "}
          <a href="https://facebook.com/volleystats" style={socialLink}>
            Facebook
          </a>
        </p>
        <p style={footerCopyright}>
          © {new Date().getFullYear()} VolleyStats. All rights reserved.
        </p>
      </div>
    </>
  );
};

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "32px 48px",
  textAlign: "center" as const,
  borderBottom: "1px solid #f0f0f0",
};

const logo = {
  margin: "0 auto",
  borderRadius: "8px",
};

const content = {
  padding: "32px 48px",
};

const footer = {
  padding: "32px 48px",
  borderTop: "1px solid #f0f0f0",
};

const footerText = {
  textAlign: "center" as const,
  color: "#737373",
  fontSize: "14px",
  lineHeight: "24px",
};

const footerParagraph = {
  margin: "8px 0",
};

const link = {
  color: "#0f172a",
  textDecoration: "underline",
};

const socialLink = {
  color: "#737373",
  textDecoration: "none",
};

const footerCopyright = {
  margin: "16px 0 0",
  color: "#a3a3a3",
  fontSize: "12px",
};

export default EmailLayout;
