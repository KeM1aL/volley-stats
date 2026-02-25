import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { MagicLinkEmail } from './_templates/magic-link.tsx'
import { NotificationEmail } from './_templates/notification.tsx'
import { RecoveryEmail } from './_templates/recovery.tsx'
import { SignUpEmail } from './_templates/sign-up.tsx'
import { getLocale, getTranslations } from './_i18n.ts'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string).replace('v1,whsec_', '')

const OTP_ACTION_TYPES = ['magiclink', 'invite', 'email', 'reauthentication', 'email_change']
const NOTIFICATION_ACTION_TYPES = ['password_changed_notification', 'email_changed_notification']

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)
  console.log('[send-email] Webhook received, payload length:', payload.length)
  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type, site_url },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
        user_metadata: {
          username: string
          lang: string
        }
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    const lang = user['user_metadata'].lang
    const locale = getLocale(lang)
    const t = getTranslations(locale)
    const supabase_url = Deno.env.get('SUPABASE_URL') ?? ''
    const resolved_site_url = site_url || supabase_url

    console.log('[send-email] Verified payload:', {
      action: email_action_type,
      to: user.email,
      lang,
      locale,
      site_url: resolved_site_url,
      has_token: !!token,
      has_token_hash: !!token_hash,
    })
    console.log('[send-email] Env check:', {
      has_resend_key: !!Deno.env.get('RESEND_API_KEY'),
      has_from: !!Deno.env.get('RESEND_FROM_EMAIL'),
      has_hook_secret: !!Deno.env.get('SEND_EMAIL_HOOK_SECRET'),
      supabase_url: !!supabase_url,
    })

    let html: string
    let subject: string

    if (email_action_type === 'signup') {
      subject = t.signup.subject
      html = await renderAsync(
        React.createElement(SignUpEmail, {
          username: user['user_metadata'].username,
          lang,
          supabase_url,
          site_url: resolved_site_url,
          token,
          token_hash,
          redirect_to,
          email_action_type,
        })
      )
    } else if (email_action_type === 'recovery') {
      subject = t.recovery.subject
      html = await renderAsync(
        React.createElement(RecoveryEmail, {
          lang,
          supabase_url,
          site_url: resolved_site_url,
          token,
          token_hash,
          redirect_to,
          email_action_type,
        })
      )
    } else if (OTP_ACTION_TYPES.includes(email_action_type)) {
      const otpKey = {
        magiclink: 'magiclink',
        invite: 'invite',
        email: 'email',
        reauthentication: 'reauthentication',
        email_change: 'emailChange',
      }[email_action_type] as keyof typeof t
      subject = (t[otpKey] as { subject: string }).subject
      html = await renderAsync(
        React.createElement(MagicLinkEmail, {
          lang,
          supabase_url,
          site_url: resolved_site_url,
          token,
          token_hash,
          redirect_to,
          email_action_type,
        })
      )
    } else if (NOTIFICATION_ACTION_TYPES.includes(email_action_type)) {
      const notifKey = {
        password_changed_notification: 'passwordChangedNotification',
        email_changed_notification: 'emailChangedNotification',
      }[email_action_type] as keyof typeof t
      subject = (t[notifKey] as { subject: string }).subject
      html = await renderAsync(
        React.createElement(NotificationEmail, {
          lang,
          site_url: resolved_site_url,
          email_action_type,
        })
      )
    } else {
      throw new Error(`Unhandled email_action_type: ${email_action_type}`)
    }

    console.log('[send-email] Template rendered, html length:', html.length, 'subject:', subject)

    const from =
      Deno.env.get('RESEND_FROM_EMAIL') ?? 'VolleyStats <onboarding@resend.dev>'

    console.log('[send-email] Sending via Resend:', { from, to: user.email, subject })
    const { data, error } = await resend.emails.send({
      from,
      to: [user.email],
      subject,
      html,
    })
    console.log('[send-email] Resend response:', { data, error })
    if (error) {
      throw error
    }
  } catch (error) {
    console.log('[send-email] ERROR:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
      raw: error,
    })
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code,
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const responseHeaders = new Headers()
  responseHeaders.set('Content-Type', 'application/json')
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders,
  })
})
