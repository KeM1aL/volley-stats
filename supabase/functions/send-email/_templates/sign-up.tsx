import { Button, Heading, Link, Section, Text } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { getLocale, getTranslations } from '../_i18n.ts'
import { EmailLayout } from './_layout.tsx'

interface SignUpEmailProps {
  username: string
  lang: string
  token: string
  supabase_url: string
  site_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
}

export const SignUpEmail = ({
  username,
  lang,
  token,
  supabase_url,
  site_url,
  email_action_type,
  redirect_to,
  token_hash,
}: SignUpEmailProps) => {
  const t = getTranslations(getLocale(lang)).signup
  const confirmUrl = `${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

  return (
    <EmailLayout preview={t.preview} site_url={site_url}>
      <Heading style={heading}>{t.heading(username)}</Heading>

      <Text style={paragraph}>{t.body}</Text>

      <Button href={confirmUrl} style={button}>
        {t.ctaText}
      </Button>

      <Text style={linkParagraph}>
        {t.linkLabel}{' '}
        <Link href={confirmUrl} style={link}>
          {confirmUrl}
        </Link>
      </Text>

      <Text style={codeLabel}>{t.codeLabel}</Text>
      <Section style={codeBox}>
        <Text style={codeText}>{token}</Text>
      </Section>

      <Text style={ignoreText}>{t.ignoreText}</Text>
    </EmailLayout>
  )
}

SignUpEmail.PreviewProps = {
  username: 'player1',
  lang: 'en',
  token: '123456',
  supabase_url: 'https://example.supabase.co',
  site_url: 'https://volleystats.app',
  email_action_type: 'signup',
  redirect_to: 'https://volleystats.app',
  token_hash: 'abc123',
} as SignUpEmailProps

export default SignUpEmail

const heading = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 24px',
  lineHeight: '1.3',
}

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#374151',
  margin: '16px 0',
}

const button = {
  backgroundColor: '#0f172a',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 28px',
  margin: '24px 0',
}

const linkParagraph = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#737373',
  margin: '24px 0 8px',
}

const link = {
  color: '#0f172a',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
}

const codeLabel = {
  fontSize: '14px',
  color: '#737373',
  margin: '24px 0 8px',
}

const codeBox = {
  backgroundColor: '#f4f4f4',
  borderRadius: '8px',
  padding: '24px',
  margin: '0 0 24px',
  border: '1px solid #e5e5e5',
}

const codeText = {
  fontSize: '30px',
  fontWeight: '700',
  color: '#0f172a',
  textAlign: 'center' as const,
  letterSpacing: '6px',
  margin: '0',
}

const ignoreText = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#737373',
  margin: '16px 0',
}