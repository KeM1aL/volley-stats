import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface EmailLayoutProps {
  preview: string
  site_url: string
  children?: React.ReactNode
}

export const EmailLayout = ({ preview, site_url, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Top accent stripe */}
          <Section style={accentStripe}>
            <Text style={accentSpacer}>&nbsp;</Text>
          </Section>

          {/* Header: logo + brand name */}
          <Section style={header}>
            <Row>
              <Column style={{ width: '52px' }}>
                <Img
                  src={`${site_url}/logo.png`}
                  width="40"
                  height="40"
                  alt="VolleyStats"
                  style={logo}
                />
              </Column>
              <Column>
                <Text style={brandName}>VolleyStats</Text>
              </Column>
            </Row>
          </Section>

          {/* Main content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={tagline}>Volleyball statistics made simple 🏐</Text>
            <Text style={footerContact}>
              Questions?{' '}
              <Link href="mailto:volleystats@blockservice.fr" style={footerLink}>
                volleystats@blockservice.fr
              </Link>
            </Text>
            <Text style={socialRow}>
              <Link href="https://x.com/volleystats" style={socialPill}>X</Link>
              {'  '}
              <Link href="https://instagram.com/volleystats" style={socialPill}>Instagram</Link>
              {'  '}
              <Link href="https://facebook.com/volleystats" style={socialPill}>Facebook</Link>
            </Text>
            <Text style={copyright}>
              © {new Date().getFullYear()} VolleyStats. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  marginBottom: '64px',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden' as const,
}

const accentStripe = {
  backgroundColor: '#0f172a',
  height: '4px',
  lineHeight: '4px',
  fontSize: '4px',
  margin: '0',
  padding: '0',
}

const accentSpacer = {
  margin: '0',
  padding: '0',
  fontSize: '1px',
  lineHeight: '4px',
  color: '#0f172a',
}

const header = {
  padding: '24px 40px',
  borderBottom: '1px solid #f0f0f0',
}

const logo = {
  borderRadius: '8px',
  display: 'block',
}

const brandName = {
  fontSize: '20px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0',
  lineHeight: '40px',
  paddingLeft: '12px',
}

const content = {
  padding: '32px 40px',
}

const footerSection = {
  padding: '24px 40px 32px',
  borderTop: '1px solid #f0f0f0',
  textAlign: 'center' as const,
}

const tagline = {
  fontSize: '14px',
  color: '#374151',
  margin: '0 0 12px',
  fontWeight: '500',
}

const footerContact = {
  fontSize: '13px',
  color: '#737373',
  margin: '0 0 16px',
  lineHeight: '22px',
}

const footerLink = {
  color: '#0f172a',
  textDecoration: 'underline',
}

const socialRow = {
  margin: '0 0 16px',
  textAlign: 'center' as const,
}

const socialPill = {
  backgroundColor: '#f4f4f4',
  borderRadius: '4px',
  padding: '4px 10px',
  color: '#374151',
  fontSize: '12px',
  textDecoration: 'none',
  margin: '0 4px',
  display: 'inline-block',
}

const copyright = {
  fontSize: '12px',
  color: '#a3a3a3',
  margin: '0',
}

export default EmailLayout
