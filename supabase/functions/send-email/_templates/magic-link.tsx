import { Button, Heading, Link, Section, Text } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { getLocale, getTranslations, type Translations } from '../_i18n.ts'
import { EmailLayout } from './_layout.tsx'

// Handles: magiclink, invite, email, reauthentication, email_change

interface MagicLinkEmailProps {
  lang: string
  token: string
  site_url: string
  confirm_url: string
  email_action_type: string
}

type OtpKey = keyof Pick<
  Translations,
  'magiclink' | 'invite' | 'email' | 'reauthentication' | 'emailChange'
>

const actionTypeToKey: Record<string, OtpKey> = {
  magiclink: 'magiclink',
  invite: 'invite',
  email: 'email',
  reauthentication: 'reauthentication',
  email_change: 'emailChange',
}

export const MagicLinkEmail = ({
  lang,
  token,
  site_url,
  confirm_url,
  email_action_type,
}: MagicLinkEmailProps) => {
  const locale = getLocale(lang)
  const translations = getTranslations(locale)
  const key = actionTypeToKey[email_action_type] ?? 'magiclink'
  const t = translations[key]

  return (
    <EmailLayout preview={t.preview} site_url={site_url} locale={locale}>
      <Heading style={heading}>{t.heading}</Heading>

      <Text style={paragraph}>{t.body}</Text>

      {t.timeWarning && <Text style={warningBox}>{t.timeWarning}</Text>}

      <Button href={confirm_url} style={button}>
        {t.ctaText}
      </Button>

      <Text style={linkParagraph}>
        {t.linkLabel}{' '}
        <Link href={confirm_url} style={link}>
          {confirm_url}
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

MagicLinkEmail.PreviewProps = {
  lang: 'en',
  token: '123456',
  site_url: 'https://volleystats.app',
  confirm_url: 'https://volleystats.app/auth/confirm?token_hash=abc123&type=magiclink',
  email_action_type: 'magiclink',
} as MagicLinkEmailProps

export default MagicLinkEmail

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

const warningBox = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#374151',
  backgroundColor: '#fef3c7',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
  border: '1px solid #fde68a',
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
