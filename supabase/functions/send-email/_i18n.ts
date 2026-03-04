export type SupportedLocale = 'en' | 'fr' | 'es' | 'it' | 'pt'

export function getLocale(lang: string | undefined): SupportedLocale {
  const supported: SupportedLocale[] = ['en', 'fr', 'es', 'it', 'pt']
  const normalized = (lang ?? 'en').toLowerCase().split('-')[0] as SupportedLocale
  return supported.includes(normalized) ? normalized : 'en'
}

type SignupTranslations = {
  subject: string
  preview: string
  heading: (username: string) => string
  body: string
  ctaText: string
  linkLabel: string
  codeLabel: string
  ignoreText: string
}

type OtpTranslations = {
  subject: string
  preview: string
  heading: string
  body: string
  ctaText: string
  linkLabel: string
  codeLabel: string
  ignoreText: string
  timeWarning?: string
  tipText?: string
}

type NotificationTranslations = {
  subject: string
  preview: string
  heading: string
  body: string
  safeText: string
  warningText: string
}

type LayoutTranslations = {
  tagline: string
  questionsLabel: string
  copyright: string
}

export type Translations = {
  signup: SignupTranslations
  magiclink: OtpTranslations
  invite: OtpTranslations
  email: OtpTranslations
  reauthentication: OtpTranslations
  recovery: OtpTranslations
  emailChange: OtpTranslations
  passwordChangedNotification: NotificationTranslations
  emailChangedNotification: NotificationTranslations
  layout: LayoutTranslations
}

// ─── English ─────────────────────────────────────────────────────────────────

const en: Translations = {
  signup: {
    subject: 'Confirm your VolleyStats account',
    preview: 'Welcome to VolleyStats! Confirm your email to get started.',
    heading: (username) => `Hey ${username ? username + ' ' : ''}! Welcome to the team 🎉`,
    body: "We're excited to have you join VolleyStats! Please confirm your email address to get started.",
    ctaText: 'Confirm Email Address',
    linkLabel: 'Or copy and paste this link into your browser:',
    codeLabel: 'Or use this confirmation code:',
    ignoreText: "If you didn't create an account with VolleyStats, you can safely ignore this email.",
  },
  magiclink: {
    subject: 'Your VolleyStats sign-in link',
    preview: 'Your VolleyStats sign-in link is ready!',
    heading: "Hey! Let's get you signed in 👋",
    body: 'Click the button below to sign in to VolleyStats. This link will work for the next hour.',
    ctaText: 'Sign In to VolleyStats',
    linkLabel: 'Or copy and paste this link into your browser:',
    codeLabel: 'Or use this login code:',
    ignoreText: "If you didn't request this sign-in link, you can safely ignore this email.",
    timeWarning: "⚠️ Security note: This link is unique to you — don't share it with anyone.",
  },
  invite: {
    subject: "You've been invited to VolleyStats",
    preview: "You've been invited to join VolleyStats!",
    heading: 'Hey! Good news 🎉',
    body: "You've been invited to join a team on VolleyStats, the simple volleyball statistics tracking platform! Click below to accept and create your account.",
    ctaText: 'Accept Invitation',
    linkLabel: 'Or copy and paste this link into your browser:',
    codeLabel: 'Or use this invitation code:',
    ignoreText: "If you didn't expect this invitation, you can safely ignore this email.",
  },
  email: {
    subject: 'Your VolleyStats sign-in code',
    preview: 'Your VolleyStats sign-in code is ready!',
    heading: "Hey! Here's your sign-in link 👋",
    body: 'Click the button below to sign in to VolleyStats with your one-time link.',
    ctaText: 'Sign In to VolleyStats',
    linkLabel: 'Or copy and paste this link into your browser:',
    codeLabel: 'Or use this login code:',
    ignoreText: "If you didn't request this sign-in link, you can safely ignore this email.",
  },
  reauthentication: {
    subject: 'VolleyStats security verification',
    preview: "Confirm it's you — VolleyStats security check",
    heading: "Hey! Let's confirm it's really you 🔐",
    body: 'A request was made to perform a sensitive action on your VolleyStats account. Please verify your identity to continue.',
    ctaText: "Confirm It's Me",
    linkLabel: 'Or copy and paste this link into your browser:',
    codeLabel: 'Or use this verification code:',
    ignoreText: "If you didn't request this, your account may be at risk — consider changing your password immediately.",
    timeWarning: '⚠️ This link expires in 10 minutes.',
  },
  recovery: {
    subject: 'Reset your VolleyStats password',
    preview: 'Reset your VolleyStats password',
    heading: 'Hey! Need to reset your password? 🔒',
    body: "We received a request to reset your password for your VolleyStats account. No worries, it happens!",
    ctaText: 'Reset Password',
    linkLabel: 'Or copy and paste this link into your browser:',
    codeLabel: 'Or use this reset code:',
    ignoreText: "If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.",
    timeWarning: '⏰ This link expires in 1 hour for security purposes.',
    tipText: "💡 Pro tip: Use a strong, unique password that you don't use anywhere else!",
  },
  emailChange: {
    subject: 'Confirm your VolleyStats email change',
    preview: 'Confirm your new email address for VolleyStats',
    heading: "Hey! Just checking it's really you 👋",
    body: "You (or someone) requested to change your VolleyStats email address. To confirm this change, click the button below.",
    ctaText: 'Confirm New Email',
    linkLabel: 'Or copy and paste this link into your browser:',
    codeLabel: 'Or use this confirmation code:',
    ignoreText: "If you didn't request this email address change, you can safely ignore this email. Your account will remain unchanged.",
  },
  passwordChangedNotification: {
    subject: 'Your VolleyStats password was changed',
    preview: 'Your VolleyStats password was changed',
    heading: 'Your password was changed 🔒',
    body: 'This is a confirmation that the password for your VolleyStats account was recently changed.',
    safeText: 'If you made this change, no further action is required.',
    warningText: "⚠️ Didn't make this change? Please reset your password immediately and contact support at volleystats@blockservice.fr.",
  },
  emailChangedNotification: {
    subject: 'Your VolleyStats email address was updated',
    preview: 'Your VolleyStats email address was updated',
    heading: 'Your email address was updated ✉️',
    body: 'This is a confirmation that the email address for your VolleyStats account has been successfully changed.',
    safeText: 'If you made this change, no further action is required. Future emails will be sent to your new address.',
    warningText: "⚠️ Didn't make this change? Please contact us immediately at volleystats@blockservice.fr to recover your account.",
  },
  layout: {
    tagline: 'Volleyball statistics made simple 🏐',
    questionsLabel: 'Questions?',
    copyright: 'All rights reserved.',
  },
}

// ─── French ──────────────────────────────────────────────────────────────────

const fr: Translations = {
  signup: {
    subject: 'Confirmez votre compte VolleyStats',
    preview: 'Bienvenue sur VolleyStats ! Confirmez votre email pour commencer.',
    heading: (username) => `Salut ${username ? username + ' ' : ''}! Bienvenue dans l'équipe 🎉`,
    body: 'Nous sommes ravis de vous accueillir sur VolleyStats ! Veuillez confirmer votre adresse email pour commencer.',
    ctaText: "Confirmer l'adresse email",
    linkLabel: 'Ou copiez-collez ce lien dans votre navigateur :',
    codeLabel: 'Ou utilisez ce code de confirmation :',
    ignoreText: "Si vous n'avez pas créé de compte sur VolleyStats, vous pouvez ignorer cet email.",
  },
  magiclink: {
    subject: 'Votre lien de connexion VolleyStats',
    preview: 'Votre lien de connexion VolleyStats est prêt !',
    heading: 'Salut ! Connectons-vous 👋',
    body: 'Cliquez sur le bouton ci-dessous pour vous connecter à VolleyStats. Ce lien sera valide pendant une heure.',
    ctaText: 'Se connecter à VolleyStats',
    linkLabel: 'Ou copiez-collez ce lien dans votre navigateur :',
    codeLabel: 'Ou utilisez ce code de connexion :',
    ignoreText: "Si vous n'avez pas demandé ce lien de connexion, vous pouvez ignorer cet email.",
    timeWarning: '⚠️ Note de sécurité : ce lien vous est unique — ne le partagez avec personne.',
  },
  invite: {
    subject: 'Vous avez été invité sur VolleyStats',
    preview: 'Vous avez été invité à rejoindre VolleyStats !',
    heading: 'Salut ! Bonne nouvelle 🎉',
    body: "Vous avez été invité à rejoindre une équipe sur VolleyStats, la plateforme simple de suivi des statistiques de volleyball ! Cliquez ci-dessous pour accepter et créer votre compte.",
    ctaText: "Accepter l'invitation",
    linkLabel: 'Ou copiez-collez ce lien dans votre navigateur :',
    codeLabel: "Ou utilisez ce code d'invitation :",
    ignoreText: "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.",
  },
  email: {
    subject: 'Votre code de connexion VolleyStats',
    preview: 'Votre code de connexion VolleyStats est prêt !',
    heading: 'Salut ! Voici votre lien de connexion 👋',
    body: 'Cliquez sur le bouton ci-dessous pour vous connecter à VolleyStats avec votre lien unique.',
    ctaText: 'Se connecter à VolleyStats',
    linkLabel: 'Ou copiez-collez ce lien dans votre navigateur :',
    codeLabel: 'Ou utilisez ce code de connexion :',
    ignoreText: "Si vous n'avez pas demandé ce lien de connexion, vous pouvez ignorer cet email.",
  },
  reauthentication: {
    subject: 'Vérification de sécurité VolleyStats',
    preview: "Confirmez que c'est bien vous — vérification de sécurité VolleyStats",
    heading: "Salut ! Confirmez que c'est bien vous 🔐",
    body: 'Une demande a été effectuée pour réaliser une action sensible sur votre compte VolleyStats. Veuillez vérifier votre identité pour continuer.',
    ctaText: 'Confirmer mon identité',
    linkLabel: 'Ou copiez-collez ce lien dans votre navigateur :',
    codeLabel: 'Ou utilisez ce code de vérification :',
    ignoreText: "Si vous n'avez pas fait cette demande, votre compte pourrait être en danger — pensez à changer votre mot de passe immédiatement.",
    timeWarning: '⚠️ Ce lien expire dans 10 minutes.',
  },
  recovery: {
    subject: 'Réinitialisez votre mot de passe VolleyStats',
    preview: 'Réinitialisez votre mot de passe VolleyStats',
    heading: 'Salut ! Besoin de réinitialiser votre mot de passe ? 🔒',
    body: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte VolleyStats. Pas de panique, ça arrive !",
    ctaText: 'Réinitialiser le mot de passe',
    linkLabel: 'Ou copiez-collez ce lien dans votre navigateur :',
    codeLabel: 'Ou utilisez ce code de réinitialisation :',
    ignoreText: "Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet email. Votre mot de passe ne sera pas modifié.",
    timeWarning: '⏰ Ce lien expire dans 1 heure pour des raisons de sécurité.',
    tipText: "💡 Conseil : utilisez un mot de passe fort et unique que vous n'utilisez nulle part ailleurs !",
  },
  emailChange: {
    subject: "Confirmez le changement d'email VolleyStats",
    preview: 'Confirmez votre nouvelle adresse email pour VolleyStats',
    heading: "Salut ! Juste pour vérifier que c'est bien vous 👋",
    body: "Vous (ou quelqu'un) avez demandé à changer l'adresse email de votre compte VolleyStats. Pour confirmer ce changement, cliquez sur le bouton ci-dessous.",
    ctaText: 'Confirmer le nouvel email',
    linkLabel: 'Ou copiez-collez ce lien dans votre navigateur :',
    codeLabel: 'Ou utilisez ce code de confirmation :',
    ignoreText: "Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet email. Votre compte restera inchangé.",
  },
  passwordChangedNotification: {
    subject: 'Votre mot de passe VolleyStats a été modifié',
    preview: 'Votre mot de passe VolleyStats a été modifié',
    heading: 'Votre mot de passe a été modifié 🔒',
    body: 'Ceci est une confirmation que le mot de passe de votre compte VolleyStats a récemment été modifié.',
    safeText: "Si vous avez effectué ce changement, aucune action supplémentaire n'est requise.",
    warningText: "⚠️ Vous n'avez pas fait ce changement ? Veuillez réinitialiser votre mot de passe immédiatement et contacter le support à volleystats@blockservice.fr.",
  },
  emailChangedNotification: {
    subject: 'Votre adresse email VolleyStats a été mise à jour',
    preview: 'Votre adresse email VolleyStats a été mise à jour',
    heading: 'Votre adresse email a été mise à jour ✉️',
    body: "Ceci est une confirmation que l'adresse email de votre compte VolleyStats a été modifiée avec succès.",
    safeText: "Si vous avez effectué ce changement, aucune action supplémentaire n'est requise. Les prochains emails seront envoyés à votre nouvelle adresse.",
    warningText: "⚠️ Vous n'avez pas fait ce changement ? Veuillez nous contacter immédiatement à volleystats@blockservice.fr pour récupérer votre compte.",
  },
  layout: {
    tagline: 'Les statistiques de volleyball simplifiées 🏐',
    questionsLabel: 'Des questions ?',
    copyright: 'Tous droits réservés.',
  },
}

// ─── Spanish ─────────────────────────────────────────────────────────────────

const es: Translations = {
  signup: {
    subject: 'Confirma tu cuenta de VolleyStats',
    preview: '¡Bienvenido a VolleyStats! Confirma tu email para empezar.',
    heading: (username) => `¡Hola ${username ? username + ' ' : ''}! Bienvenido al equipo 🎉`,
    body: '¡Nos alegra que te hayas unido a VolleyStats! Confirma tu dirección de email para empezar.',
    ctaText: 'Confirmar dirección de email',
    linkLabel: 'O copia y pega este enlace en tu navegador:',
    codeLabel: 'O usa este código de confirmación:',
    ignoreText: 'Si no creaste una cuenta en VolleyStats, puedes ignorar este email.',
  },
  magiclink: {
    subject: 'Tu enlace de inicio de sesión en VolleyStats',
    preview: '¡Tu enlace de inicio de sesión en VolleyStats está listo!',
    heading: '¡Hola! Vamos a conectarte 👋',
    body: 'Haz clic en el botón de abajo para iniciar sesión en VolleyStats. Este enlace será válido durante una hora.',
    ctaText: 'Iniciar sesión en VolleyStats',
    linkLabel: 'O copia y pega este enlace en tu navegador:',
    codeLabel: 'O usa este código de inicio de sesión:',
    ignoreText: 'Si no solicitaste este enlace, puedes ignorar este email.',
    timeWarning: '⚠️ Nota de seguridad: este enlace es único para ti — ¡no lo compartas con nadie!',
  },
  invite: {
    subject: 'Te han invitado a VolleyStats',
    preview: '¡Has sido invitado a unirte a VolleyStats!',
    heading: '¡Hola! Buenas noticias 🎉',
    body: '¡Has sido invitado a unirte a un equipo en VolleyStats, la plataforma sencilla de seguimiento de estadísticas de voleibol! Haz clic abajo para aceptar y crear tu cuenta.',
    ctaText: 'Aceptar invitación',
    linkLabel: 'O copia y pega este enlace en tu navegador:',
    codeLabel: 'O usa este código de invitación:',
    ignoreText: 'Si no esperabas esta invitación, puedes ignorar este email.',
  },
  email: {
    subject: 'Tu código de inicio de sesión en VolleyStats',
    preview: '¡Tu código de inicio de sesión en VolleyStats está listo!',
    heading: '¡Hola! Aquí está tu enlace de inicio de sesión 👋',
    body: 'Haz clic en el botón de abajo para iniciar sesión en VolleyStats con tu enlace de un solo uso.',
    ctaText: 'Iniciar sesión en VolleyStats',
    linkLabel: 'O copia y pega este enlace en tu navegador:',
    codeLabel: 'O usa este código de inicio de sesión:',
    ignoreText: 'Si no solicitaste este enlace, puedes ignorar este email.',
  },
  reauthentication: {
    subject: 'Verificación de seguridad de VolleyStats',
    preview: 'Confirma que eres tú — verificación de seguridad de VolleyStats',
    heading: '¡Hola! Vamos a confirmar que eres tú 🔐',
    body: 'Se ha solicitado realizar una acción sensible en tu cuenta de VolleyStats. Por favor, verifica tu identidad para continuar.',
    ctaText: 'Confirmar que soy yo',
    linkLabel: 'O copia y pega este enlace en tu navegador:',
    codeLabel: 'O usa este código de verificación:',
    ignoreText: 'Si no hiciste esta solicitud, tu cuenta puede estar en riesgo — considera cambiar tu contraseña inmediatamente.',
    timeWarning: '⚠️ Este enlace caduca en 10 minutos.',
  },
  recovery: {
    subject: 'Restablece tu contraseña de VolleyStats',
    preview: 'Restablece tu contraseña de VolleyStats',
    heading: '¡Hola! ¿Necesitas restablecer tu contraseña? 🔒',
    body: '¡Recibimos una solicitud para restablecer la contraseña de tu cuenta de VolleyStats. No te preocupes, le pasa a todos!',
    ctaText: 'Restablecer contraseña',
    linkLabel: 'O copia y pega este enlace en tu navegador:',
    codeLabel: 'O usa este código de restablecimiento:',
    ignoreText: 'Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu contraseña no será cambiada.',
    timeWarning: '⏰ Este enlace caduca en 1 hora por razones de seguridad.',
    tipText: '💡 Consejo: usa una contraseña segura y única que no uses en ningún otro sitio.',
  },
  emailChange: {
    subject: 'Confirma el cambio de email en VolleyStats',
    preview: 'Confirma tu nueva dirección de email en VolleyStats',
    heading: '¡Hola! Solo verificando que eres tú 👋',
    body: 'Tú (o alguien) ha solicitado cambiar la dirección de email de tu cuenta de VolleyStats. Para confirmar este cambio, haz clic en el botón de abajo.',
    ctaText: 'Confirmar nuevo email',
    linkLabel: 'O copia y pega este enlace en tu navegador:',
    codeLabel: 'O usa este código de confirmación:',
    ignoreText: 'Si no solicitaste este cambio, puedes ignorar este email. Tu cuenta no será modificada.',
  },
  passwordChangedNotification: {
    subject: 'Tu contraseña de VolleyStats fue cambiada',
    preview: 'Tu contraseña de VolleyStats fue cambiada',
    heading: 'Tu contraseña fue cambiada 🔒',
    body: 'Esta es una confirmación de que la contraseña de tu cuenta de VolleyStats fue cambiada recientemente.',
    safeText: 'Si realizaste este cambio, no es necesaria ninguna acción adicional.',
    warningText: '⚠️ ¿No realizaste este cambio? Restablece tu contraseña inmediatamente y contacta al soporte en volleystats@blockservice.fr.',
  },
  emailChangedNotification: {
    subject: 'Tu dirección de email de VolleyStats fue actualizada',
    preview: 'Tu dirección de email de VolleyStats fue actualizada',
    heading: 'Tu dirección de email fue actualizada ✉️',
    body: 'Esta es una confirmación de que la dirección de email de tu cuenta de VolleyStats fue cambiada correctamente.',
    safeText: 'Si realizaste este cambio, no es necesaria ninguna acción adicional. Los próximos emails se enviarán a tu nueva dirección.',
    warningText: '⚠️ ¿No realizaste este cambio? Contáctanos inmediatamente en volleystats@blockservice.fr para recuperar tu cuenta.',
  },
  layout: {
    tagline: 'Estadísticas de voleibol hechas simples 🏐',
    questionsLabel: '¿Preguntas?',
    copyright: 'Todos los derechos reservados.',
  },
}

// ─── Italian ─────────────────────────────────────────────────────────────────

const it: Translations = {
  signup: {
    subject: 'Conferma il tuo account VolleyStats',
    preview: 'Benvenuto su VolleyStats! Conferma la tua email per iniziare.',
    heading: (username) => `Ciao ${username ? username + ' ' : ''}! Benvenuto nella squadra 🎉`,
    body: 'Siamo entusiasti di averti su VolleyStats! Conferma il tuo indirizzo email per iniziare.',
    ctaText: "Conferma l'indirizzo email",
    linkLabel: 'Oppure copia e incolla questo link nel tuo browser:',
    codeLabel: 'Oppure usa questo codice di conferma:',
    ignoreText: 'Se non hai creato un account su VolleyStats, puoi ignorare questa email.',
  },
  magiclink: {
    subject: 'Il tuo link di accesso VolleyStats',
    preview: 'Il tuo link di accesso VolleyStats è pronto!',
    heading: 'Ciao! Accediamo 👋',
    body: "Clicca il pulsante qui sotto per accedere a VolleyStats. Questo link sarà valido per un'ora.",
    ctaText: 'Accedi a VolleyStats',
    linkLabel: 'Oppure copia e incolla questo link nel tuo browser:',
    codeLabel: 'Oppure usa questo codice di accesso:',
    ignoreText: 'Se non hai richiesto questo link, puoi ignorare questa email.',
    timeWarning: '⚠️ Nota di sicurezza: questo link è unico per te — non condividerlo con nessuno.',
  },
  invite: {
    subject: 'Sei stato invitato su VolleyStats',
    preview: 'Sei stato invitato a unirti a VolleyStats!',
    heading: 'Ciao! Buone notizie 🎉',
    body: "Sei stato invitato a unirti a una squadra su VolleyStats, la semplice piattaforma per il monitoraggio delle statistiche di pallavolo! Clicca qui sotto per accettare e creare il tuo account.",
    ctaText: "Accetta l'invito",
    linkLabel: 'Oppure copia e incolla questo link nel tuo browser:',
    codeLabel: "Oppure usa questo codice d'invito:",
    ignoreText: "Se non ti aspettavi questo invito, puoi ignorare questa email.",
  },
  email: {
    subject: 'Il tuo codice di accesso VolleyStats',
    preview: 'Il tuo codice di accesso VolleyStats è pronto!',
    heading: 'Ciao! Ecco il tuo link di accesso 👋',
    body: 'Clicca il pulsante qui sotto per accedere a VolleyStats con il tuo link monouso.',
    ctaText: 'Accedi a VolleyStats',
    linkLabel: 'Oppure copia e incolla questo link nel tuo browser:',
    codeLabel: 'Oppure usa questo codice di accesso:',
    ignoreText: 'Se non hai richiesto questo link, puoi ignorare questa email.',
  },
  reauthentication: {
    subject: 'Verifica di sicurezza VolleyStats',
    preview: 'Conferma che sei tu — verifica di sicurezza VolleyStats',
    heading: 'Ciao! Confermiamo che sei tu 🔐',
    body: "È stata effettuata una richiesta per eseguire un'azione sensibile sul tuo account VolleyStats. Verifica la tua identità per continuare.",
    ctaText: 'Conferma la mia identità',
    linkLabel: 'Oppure copia e incolla questo link nel tuo browser:',
    codeLabel: 'Oppure usa questo codice di verifica:',
    ignoreText: 'Se non hai fatto questa richiesta, il tuo account potrebbe essere a rischio — considera di cambiare la tua password immediatamente.',
    timeWarning: '⚠️ Questo link scade tra 10 minuti.',
  },
  recovery: {
    subject: 'Reimposta la tua password VolleyStats',
    preview: 'Reimposta la tua password VolleyStats',
    heading: 'Ciao! Devi reimpostare la tua password? 🔒',
    body: 'Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account VolleyStats. Nessun problema, capita!',
    ctaText: 'Reimposta la password',
    linkLabel: 'Oppure copia e incolla questo link nel tuo browser:',
    codeLabel: 'Oppure usa questo codice di reimpostazione:',
    ignoreText: 'Se non hai richiesto la reimpostazione della password, puoi ignorare questa email. La tua password non verrà modificata.',
    timeWarning: '⏰ Questo link scade tra 1 ora per motivi di sicurezza.',
    tipText: "💡 Consiglio: usa una password sicura e unica che non usi altrove!",
  },
  emailChange: {
    subject: 'Conferma la modifica email di VolleyStats',
    preview: 'Conferma il tuo nuovo indirizzo email per VolleyStats',
    heading: 'Ciao! Solo per verificare che sei tu 👋',
    body: "Tu (o qualcuno) hai richiesto di cambiare l'indirizzo email del tuo account VolleyStats. Per confermare questa modifica, clicca il pulsante qui sotto.",
    ctaText: 'Conferma il nuovo indirizzo email',
    linkLabel: 'Oppure copia e incolla questo link nel tuo browser:',
    codeLabel: 'Oppure usa questo codice di conferma:',
    ignoreText: 'Se non hai richiesto questa modifica, puoi ignorare questa email. Il tuo account rimarrà invariato.',
  },
  passwordChangedNotification: {
    subject: 'La tua password VolleyStats è stata modificata',
    preview: 'La tua password VolleyStats è stata modificata',
    heading: 'La tua password è stata modificata 🔒',
    body: 'Questa è una conferma che la password del tuo account VolleyStats è stata recentemente modificata.',
    safeText: "Se hai effettuato questa modifica, non è necessaria alcuna ulteriore azione.",
    warningText: '⚠️ Non hai effettuato questa modifica? Reimposta immediatamente la tua password e contatta il supporto a volleystats@blockservice.fr.',
  },
  emailChangedNotification: {
    subject: "Il tuo indirizzo email VolleyStats è stato aggiornato",
    preview: "Il tuo indirizzo email VolleyStats è stato aggiornato",
    heading: 'Il tuo indirizzo email è stato aggiornato ✉️',
    body: "Questa è una conferma che l'indirizzo email del tuo account VolleyStats è stato modificato con successo.",
    safeText: "Se hai effettuato questa modifica, non è necessaria alcuna ulteriore azione. Le email future saranno inviate al tuo nuovo indirizzo.",
    warningText: '⚠️ Non hai effettuato questa modifica? Contattaci immediatamente a volleystats@blockservice.fr per recuperare il tuo account.',
  },
  layout: {
    tagline: 'Statistiche di pallavolo semplificate 🏐',
    questionsLabel: 'Domande?',
    copyright: 'Tutti i diritti riservati.',
  },
}

// ─── Portuguese ───────────────────────────────────────────────────────────────

const pt: Translations = {
  signup: {
    subject: 'Confirme sua conta VolleyStats',
    preview: 'Bem-vindo ao VolleyStats! Confirme seu email para começar.',
    heading: (username) => `Olá ${username ? username + ' ' : ''}! Bem-vindo à equipe 🎉`,
    body: 'Estamos animados em tê-lo no VolleyStats! Confirme seu endereço de email para começar.',
    ctaText: 'Confirmar endereço de email',
    linkLabel: 'Ou copie e cole este link no seu navegador:',
    codeLabel: 'Ou use este código de confirmação:',
    ignoreText: 'Se não criou uma conta no VolleyStats, pode ignorar este email.',
  },
  magiclink: {
    subject: 'Seu link de acesso ao VolleyStats',
    preview: 'Seu link de acesso ao VolleyStats está pronto!',
    heading: 'Olá! Vamos fazer seu login 👋',
    body: 'Clique no botão abaixo para fazer login no VolleyStats. Este link será válido por uma hora.',
    ctaText: 'Entrar no VolleyStats',
    linkLabel: 'Ou copie e cole este link no seu navegador:',
    codeLabel: 'Ou use este código de login:',
    ignoreText: 'Se não solicitou este link, pode ignorar este email.',
    timeWarning: '⚠️ Nota de segurança: este link é único para você — não o compartilhe com ninguém.',
  },
  invite: {
    subject: 'Você foi convidado para o VolleyStats',
    preview: 'Você foi convidado a se juntar ao VolleyStats!',
    heading: 'Olá! Boas notícias 🎉',
    body: 'Você foi convidado a se juntar a uma equipe no VolleyStats, a plataforma simples de rastreamento de estatísticas de vôlei! Clique abaixo para aceitar e criar sua conta.',
    ctaText: 'Aceitar convite',
    linkLabel: 'Ou copie e cole este link no seu navegador:',
    codeLabel: 'Ou use este código de convite:',
    ignoreText: 'Se não esperava este convite, pode ignorar este email.',
  },
  email: {
    subject: 'Seu código de acesso ao VolleyStats',
    preview: 'Seu código de acesso ao VolleyStats está pronto!',
    heading: 'Olá! Aqui está seu link de acesso 👋',
    body: 'Clique no botão abaixo para fazer login no VolleyStats com seu link de uso único.',
    ctaText: 'Entrar no VolleyStats',
    linkLabel: 'Ou copie e cole este link no seu navegador:',
    codeLabel: 'Ou use este código de acesso:',
    ignoreText: 'Se não solicitou este link, pode ignorar este email.',
  },
  reauthentication: {
    subject: 'Verificação de segurança do VolleyStats',
    preview: 'Confirme que é você — verificação de segurança do VolleyStats',
    heading: 'Olá! Vamos confirmar que é você 🔐',
    body: 'Uma solicitação foi feita para realizar uma ação sensível na sua conta VolleyStats. Verifique sua identidade para continuar.',
    ctaText: 'Confirmar que sou eu',
    linkLabel: 'Ou copie e cole este link no seu navegador:',
    codeLabel: 'Ou use este código de verificação:',
    ignoreText: 'Se não fez esta solicitação, sua conta pode estar em risco — considere alterar sua senha imediatamente.',
    timeWarning: '⚠️ Este link expira em 10 minutos.',
  },
  recovery: {
    subject: 'Redefina sua senha do VolleyStats',
    preview: 'Redefina sua senha do VolleyStats',
    heading: 'Olá! Precisa redefinir sua senha? 🔒',
    body: 'Recebemos um pedido para redefinir a senha da sua conta VolleyStats. Não se preocupe, acontece!',
    ctaText: 'Redefinir senha',
    linkLabel: 'Ou copie e cole este link no seu navegador:',
    codeLabel: 'Ou use este código de redefinição:',
    ignoreText: 'Se não solicitou uma redefinição de senha, pode ignorar este email. Sua senha não será alterada.',
    timeWarning: '⏰ Este link expira em 1 hora por razões de segurança.',
    tipText: '💡 Dica: use uma senha forte e única que você não usa em nenhum outro lugar!',
  },
  emailChange: {
    subject: 'Confirme a alteração de email no VolleyStats',
    preview: 'Confirme seu novo endereço de email no VolleyStats',
    heading: 'Olá! Só verificando que é você 👋',
    body: 'Você (ou alguém) solicitou alterar o endereço de email da sua conta VolleyStats. Para confirmar esta alteração, clique no botão abaixo.',
    ctaText: 'Confirmar novo email',
    linkLabel: 'Ou copie e cole este link no seu navegador:',
    codeLabel: 'Ou use este código de confirmação:',
    ignoreText: 'Se não solicitou esta alteração, pode ignorar este email. Sua conta permanecerá sem alterações.',
  },
  passwordChangedNotification: {
    subject: 'Sua senha do VolleyStats foi alterada',
    preview: 'Sua senha do VolleyStats foi alterada',
    heading: 'Sua senha foi alterada 🔒',
    body: 'Esta é uma confirmação de que a senha da sua conta VolleyStats foi alterada recentemente.',
    safeText: 'Se você fez esta alteração, nenhuma ação adicional é necessária.',
    warningText: '⚠️ Não fez esta alteração? Redefina sua senha imediatamente e entre em contato com o suporte em volleystats@blockservice.fr.',
  },
  emailChangedNotification: {
    subject: 'Seu endereço de email do VolleyStats foi atualizado',
    preview: 'Seu endereço de email do VolleyStats foi atualizado',
    heading: 'Seu endereço de email foi atualizado ✉️',
    body: 'Esta é uma confirmação de que o endereço de email da sua conta VolleyStats foi alterado com sucesso.',
    safeText: 'Se você fez esta alteração, nenhuma ação adicional é necessária. Futuros emails serão enviados para seu novo endereço.',
    warningText: '⚠️ Não fez esta alteração? Entre em contato conosco imediatamente em volleystats@blockservice.fr para recuperar sua conta.',
  },
  layout: {
    tagline: 'Estatísticas de vôlei simplificadas 🏐',
    questionsLabel: 'Dúvidas?',
    copyright: 'Todos os direitos reservados.',
  },
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const translationsMap: Record<SupportedLocale, Translations> = { en, fr, es, it, pt }

export function getTranslations(locale: SupportedLocale): Translations {
  return translationsMap[locale]
}
