import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { getLocale, getTranslations, type Translations } from '../_i18n.ts'
import { EmailLayout } from './_layout.tsx'

// Handles: password_changed_notification, email_changed_notification
// No CTA link — purely informational

interface NotificationEmailProps {
  lang: string
  site_url: string
  email_action_type: string
}

type NotificationKey = keyof Pick<
  Translations,
  'passwordChangedNotification' | 'emailChangedNotification'
>

const actionTypeToKey: Record<string, NotificationKey> = {
  password_changed_notification: 'passwordChangedNotification',
  email_changed_notification: 'emailChangedNotification',
}

export const NotificationEmail = ({
  lang,
  site_url,
  email_action_type,
}: NotificationEmailProps) => {
  const translations = getTranslations(getLocale(lang))
  const key = actionTypeToKey[email_action_type] ?? 'passwordChangedNotification'
  const t = translations[key]

  return (
    <EmailLayout preview={t.preview} site_url={site_url}>
      <Heading style={heading}>{t.heading}</Heading>

      <Text style={paragraph}>{t.body}</Text>

      <Text style={safeBox}>{t.safeText}</Text>

      <Text style={warningBox}>{t.warningText}</Text>

      <Text style={signature}>
        Stay secure!
        <br />
        The VolleyStats Team
      </Text>
    </EmailLayout>
  )
}

NotificationEmail.PreviewProps = {
  lang: 'en',
  site_url: 'https://volleystats.app',
  email_action_type: 'password_changed_notification',
} as NotificationEmailProps

export default NotificationEmail

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

const safeBox = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#374151',
  backgroundColor: '#f0fdf4',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
  border: '1px solid #d1fae5',
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

const signature = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#374151',
  margin: '32px 0 0',
}
