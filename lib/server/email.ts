import 'server-only'
import { admin } from './clients'

/**
 * Envoi d'emails transactionnels via Resend (https://resend.com).
 * Nécessite RESEND_API_KEY et EMAIL_FROM (ex. « Shareat <reservations@votre-domaine.fr> »).
 * Sans configuration, l'envoi est ignoré : le site fonctionne, simplement sans emails.
 */
export async function sendEmail(to: string | null | undefined, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!to) return false
  if (!key || !from) {
    console.info(`Email non envoyé (RESEND_API_KEY ou EMAIL_FROM manquant) : ${subject}`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    if (!res.ok) console.error('Resend', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (e) {
    console.error('Envoi d’email impossible', e)
    return false
  }
}

export async function userEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await admin().auth.admin.getUserById(userId)
    return data.user?.email ?? null
  } catch {
    return null
  }
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://shareat-fr.vercel.app').replace(/\/$/, '')

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Gabarit commun, compatible avec les clients email (tableaux, styles en ligne). */
export function emailLayout(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const body = paragraphs.map(p => `<p style="margin:0 0 14px;color:#AFC0D4;font-size:15px;line-height:1.6">${p}</p>`).join('')
  const button = cta
    ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#A7C7E7;color:#06080D;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px;font-size:14px">${esc(cta.label)}</a></p>`
    : ''
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#06080D;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06080D;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0F1828;border:1px solid #26314A;border-radius:18px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;color:#E6EEF7;font-size:20px;letter-spacing:6px;text-transform:uppercase">Shareat</p>
<h1 style="margin:0 0 18px;color:#E6EEF7;font-size:24px;font-weight:400">${esc(title)}</h1>
${body}${button}
</td></tr></table>
<p style="color:#5F708A;font-size:12px;margin:18px 0 0">Shareat — tables d’hôtes chez l’habitant · <a href="${siteUrl()}/confidentialite" style="color:#8296AE">Confidentialité</a></p>
</td></tr></table></body></html>`
}

export { esc }
