# VolleyStats Email Templates

Professional email templates for Supabase authentication, built with React Email and designed to match the VolleyStats brand.

## Overview

This directory contains compiled HTML email templates used by Supabase for authentication flows. The source templates are React components located in `/emails/` and are built using React Email.

## Available Templates

### 1. **confirm-signup.html** - Welcome & Email Confirmation
- **When sent**: New user signs up
- **Purpose**: Welcome message + email verification
- **Supabase variable**: `{{.ConfirmationURL}}`
- **Features**:
  - Friendly welcome message
  - Clear call-to-action button
  - Feature highlights
  - Fallback link

### 2. **invite.html** - Team/Club Invitation
- **When sent**: User is invited to join a team or club
- **Purpose**: Invitation acceptance
- **Supabase variable**: `{{.ConfirmationURL}}`
- **Features**:
  - Warm invitation message
  - VolleyStats feature overview
  - Accept invitation CTA

### 3. **magic-link.html** - Passwordless Sign-In
- **When sent**: User requests magic link sign-in
- **Purpose**: Passwordless authentication
- **Supabase variable**: `{{.ConfirmationURL}}`
- **Features**:
  - Security notice
  - One-hour expiry warning
  - Clear instructions

### 4. **change-email.html** - Email Address Change
- **When sent**: User changes their email address
- **Purpose**: Confirm new email address
- **Supabase variables**: `{{.Email}}`, `{{.ConfirmationURL}}`
- **Features**:
  - Shows new email address
  - Security information
  - Ignore option if unauthorized

### 5. **reset-password.html** - Password Reset
- **When sent**: User requests password reset
- **Purpose**: Reset password link
- **Supabase variable**: `{{.ConfirmationURL}}`
- **Features**:
  - Reassuring tone
  - Time-sensitive warning (1 hour)
  - Security tips

## Design System

### Brand Colors
- **Primary**: `#0f172a` (Dark slate)
- **Background**: `#ffffff` (White)
- **Secondary text**: `#737373` (Gray)
- **Accent**: `#374151` (Dark gray)

### Typography
- **Font family**: Inter (with fallbacks)
- **Heading size**: 28px
- **Body text**: 16px
- **Small text**: 14px

### Layout
- **Max width**: 600px (email standard)
- **Border radius**: 8px
- **Padding**: Generous (32-48px)
- **Responsive**: Mobile-optimized

## Development Workflow

### Source Files
React Email templates are located in `/emails/`:
```
emails/
  ├── components/
  │   ├── email-layout.tsx    # Shared layout
  │   └── email-button.tsx    # CTA button
  ├── confirm-signup.tsx
  ├── invite.tsx
  ├── magic-link.tsx
  ├── change-email.tsx
  └── reset-password.tsx
```

### Development Commands

```bash
# Start preview server (http://localhost:3000)
pnpm email:dev

# Build templates to HTML
pnpm email:build

# Preview on alternative port
pnpm email:preview
```

### Making Changes

1. **Edit React components** in `/emails/`
2. **Preview changes** with `pnpm email:dev`
3. **Build to HTML** with `pnpm email:build`
4. **Test locally** with Supabase Inbucket (http://localhost:54324)

### Template Variables

Supabase automatically replaces these variables:
- `{{.SiteURL}}` - Configured site URL
- `{{.ConfirmationURL}}` - Auth confirmation link
- `{{.Token}}` - OTP token
- `{{.TokenHash}}` - Token hash
- `{{.Email}}` - User's email address

**Note**: In React Email source, these are HTML-encoded as `&#123;&#123;.Variable&#125;&#125;` to prevent JSX parsing issues.

## Configuration

### Local Development (supabase/config.toml)

Email templates are configured in [supabase/config.toml](../config.toml):

```toml
[auth.email.template.confirm_signup]
subject = "Welcome to VolleyStats! 🏐"
content_path = "./supabase/templates/auth/confirm-signup.html"

[auth.email.template.invite]
subject = "You've been invited to VolleyStats! 🏐"
content_path = "./supabase/templates/auth/invite.html"

# ... (other templates)
```

### Production Deployment

#### Automated Deployment (Recommended)

Use the deployment script to automatically upload templates to production:

```bash
# 1. Set environment variables in .env or .env.local
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_ACCESS_TOKEN=your-access-token

# 2. Build templates
pnpm email:build

# 3. Deploy to production
pnpm email:deploy
```

**Required Environment Variables**:
- `SUPABASE_PROJECT_REF` - Project reference ID from your Supabase dashboard URL
- `SUPABASE_ACCESS_TOKEN` - Personal access token (generate at https://supabase.com/dashboard/account/tokens)

#### Manual Deployment

Alternatively, copy templates manually in Supabase dashboard:
1. Navigate to Authentication > Email Templates
2. Copy HTML from `supabase/templates/auth/` for each template
3. Paste into corresponding template editor

#### SMTP Setup with Resend

Configure SMTP in `supabase/config.toml` or Supabase dashboard:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 587
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "volleystats@blockservice.fr"
sender_name = "VolleyStats"
```

**Environment Variable Required**:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
```

### Updating Site URL

Update in Supabase dashboard or config:
- **Local**: `http://127.0.0.1:3000` (default)
- **Production**: `https://volley-stats.vercel.app/`

This affects:
- Logo URL: `{{.SiteURL}}/logo.png`
- Redirect URLs after authentication

## Testing

### Local Testing
1. Start Supabase locally: `npx supabase start`
2. Access Inbucket: http://localhost:54324
3. Trigger auth flow (sign up, reset password, etc.)
4. View emails in Inbucket interface

### Email Client Testing
Test rendering in major clients:
- Gmail (desktop & mobile)
- Outlook (desktop & web)
- Apple Mail (iOS & macOS)
- Yahoo Mail
- Thunderbird

### Testing Checklist
- [ ] All links work correctly
- [ ] Logo displays (test with images off)
- [ ] Responsive on mobile
- [ ] Text is readable
- [ ] Buttons have large tap targets (44px min)
- [ ] Supabase variables render correctly
- [ ] Spam filter test (SpamAssassin, etc.)

## Troubleshooting

### Templates not updating
- Run `pnpm email:build` to regenerate HTML
- Restart Supabase: `npx supabase stop` then `npx supabase start`
- Clear browser cache when viewing Inbucket

### Supabase variables not rendering
- Verify path in `config.toml` is correct
- Check HTML file exists in `supabase/templates/auth/`
- Ensure variables use correct syntax: `{{.Variable}}`

### Logo not displaying
- Confirm logo exists at `/public/logo.png`
- Verify `site_url` is configured correctly
- Test with absolute URL as fallback

### Build errors
- Check for unescaped `{{` in React Email source
- Use HTML entities: `&#123;&#123;.Variable&#125;&#125;`
- Verify all imports are correct

## Additional Resources

- [React Email Documentation](https://react.email)
- [Supabase Auth Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Resend Documentation](https://resend.com/docs)
- [Email Client Support](https://www.caniemail.com/)

## Contact

For issues or questions about email templates:
- Email: volleystats@blockservice.fr
- Update templates in `/emails/` directory
- Rebuild with `pnpm email:build`

---

**Last Updated**: December 2025
**Version**: 1.0.0
