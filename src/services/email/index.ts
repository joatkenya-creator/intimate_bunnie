import 'server-only'
import { site } from '@/config/site'
import * as t from './templates'
import type { OrderMail, WelcomeUser } from './templates'

export * from './templates'

// Email boundary. Delivery goes over Resend's HTTP API — plain fetch. An SMTP
// client would hold a socket open, which suits a serverless runtime badly, and
// an SDK would add a dependency for one POST.
//
// Nothing here throws. A mail outage must never fail a registration or, worse,
// a paid checkout: the order is already in the database by the time we send.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** Envelope sender. Must be an address on a domain verified with the provider. */
function from(): string {
  return process.env.EMAIL_FROM ?? `${site.name} <${site.email}>`
}

/** Replies land wherever care@ is routed — see docs/EMAIL.md. */
function replyTo(): string {
  return process.env.EMAIL_REPLY_TO ?? site.email
}

async function deliver(to: string, mail: t.Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Local development without a key: log the subject so flows stay debuggable.
    console.info(`[email] no RESEND_API_KEY — skipped "${mail.subject}" to ${to}`)
    return false
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: from(),
        to: [to],
        reply_to: replyTo(),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    })
    if (!response.ok) {
      console.error(`[email] "${mail.subject}" to ${to} failed: ${response.status} ${await response.text()}`)
    }
    return response.ok
    // ponytail: send is fire-and-forget with no retry. If a dropped receipt ever
    // matters, put a queue in front of deliver() rather than
    // retrying inline — the request should not wait on the mail provider.
  } catch (error) {
    console.error(`[email] "${mail.subject}" to ${to} threw:`, error)
    return false
  }
}

export const sendWelcome = (user: WelcomeUser): Promise<boolean> => deliver(user.email, t.welcome(user))

export const sendVerifyEmail = (to: string, url: string, expiresInHours: number): Promise<boolean> =>
  deliver(to, t.verifyEmail({ url, expiresInHours }))

export const sendPasswordReset = (to: string, url: string, expiresInMinutes: number): Promise<boolean> =>
  deliver(to, t.passwordReset({ url, expiresInMinutes }))

export const sendPasswordChanged = (to: string, changedAt: Date): Promise<boolean> =>
  deliver(to, t.passwordChanged({ changedAt }))

export const sendProfileUpdated = (to: string, changes: string[]): Promise<boolean> =>
  deliver(to, t.profileUpdated({ changes }))

export const sendPreferencesUpdated = (to: string, preferences: [string, string][]): Promise<boolean> =>
  deliver(to, t.preferencesUpdated({ preferences }))

export const sendOrderPlaced = (to: string, order: OrderMail): Promise<boolean> => deliver(to, t.orderPlaced(order))

export const sendReturnReceived = (to: string, number: string, items: string[]): Promise<boolean> =>
  deliver(to, t.returnReceived({ number, items }))

export const sendReturnApproved = (
  to: string,
  number: string,
  refundCents: number,
  instructions: string,
): Promise<boolean> => deliver(to, t.returnApproved({ number, refundCents, instructions }))
