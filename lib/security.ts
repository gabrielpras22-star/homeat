// Règles de sécurité partagées (navigateur et serveur) pour les comptes et les formulaires.
// Le navigateur aide l'utilisateur ; le serveur (Supabase / routes API) doit appliquer
// les mêmes règles, car un contrôle côté navigateur peut toujours être contourné.

export const PASSWORD_MIN = 10

/** Mots de passe trop courants, refusés d'office (en plus de la vérification « fuites » de Supabase). */
const COMMON = ['motdepasse', 'password', 'azerty', 'qwerty', '123456', 'shareat', 'soleil', 'bonjour', 'loveyou', 'admin']

export type PasswordCheck = { id: string; label: string; ok: boolean }

export function passwordChecks(pw: string, ctx: { email?: string; name?: string } = {}): PasswordCheck[] {
  const lower = pw.toLowerCase()
  const personal = [ctx.email?.split('@')[0], ...(ctx.name || '').split(/\s+/)]
    .map(s => (s || '').toLowerCase()).filter(s => s.length >= 3)
  return [
    { id: 'len', label: `${PASSWORD_MIN} caractères ou plus`, ok: pw.length >= PASSWORD_MIN },
    { id: 'upper', label: 'Une majuscule', ok: /[A-ZÀ-Ý]/.test(pw) },
    { id: 'lower', label: 'Une minuscule', ok: /[a-zà-ÿ]/.test(pw) },
    { id: 'digit', label: 'Un chiffre', ok: /\d/.test(pw) },
    { id: 'common', label: 'Pas un mot de passe connu', ok: pw.length > 0 && !COMMON.some(c => lower.includes(c)) },
    { id: 'personal', label: 'Sans votre nom ni email', ok: pw.length > 0 && !personal.some(p => lower.includes(p)) },
  ]
}

/** Force de 0 à 4, pour la jauge. */
export function passwordScore(pw: string, ctx?: { email?: string; name?: string }): number {
  if (!pw) return 0
  const checks = passwordChecks(pw, ctx)
  const passed = checks.filter(c => c.ok).length
  let score = Math.floor((passed / checks.length) * 3)
  if (passed === checks.length && (pw.length >= 14 || /[^A-Za-z0-9À-ÿ]/.test(pw))) score = 4
  return score
}

export const passwordOk = (pw: string, ctx?: { email?: string; name?: string }) => passwordChecks(pw, ctx).every(c => c.ok)

export const SCORE_LABEL = ['Trop faible', 'Faible', 'Moyen', 'Bon', 'Excellent']
export const SCORE_COLOR = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--sky)', 'var(--ok)']

/** Format d'email raisonnable (la vraie preuve reste le code envoyé par email). */
export const emailOk = (email: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(email.trim())

/** Âge à partir d'une date AAAA-MM-JJ. */
export function ageFrom(iso: string, now = new Date()): number | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age
}

/** Nettoie un texte libre : espaces superflus, caractères de contrôle, longueur maximale. */
export const cleanText = (s: string, max = 2000) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max)

/** Un nom de personne : lettres, espaces, tirets, apostrophes. */
export const nameOk = (s: string) => /^[A-Za-zÀ-ÖØ-öø-ÿ' ’-]{2,60}$/.test(s.trim())

/**
 * Limiteur d'essais (côté navigateur, en complément de celui de Supabase Auth) :
 * après `max` échecs, attente qui double à chaque nouveau blocage.
 */
export function createThrottle(max = 5, baseMs = 30_000) {
  let fails = 0
  let lockedUntil = 0
  let locks = 0
  return {
    remainingMs: () => Math.max(0, lockedUntil - Date.now()),
    fail() {
      fails++
      if (fails >= max) { locks++; lockedUntil = Date.now() + baseMs * 2 ** (locks - 1); fails = 0 }
    },
    reset() { fails = 0; locks = 0; lockedUntil = 0 },
    attemptsLeft: () => max - fails,
  }
}

/** Numéro de demande lisible pour le service client (ex. SH-7K3P-92). */
export function ticketId() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => a[b % a.length]).join('')
  return `SH-${pick(4)}-${pick(2)}`
}
