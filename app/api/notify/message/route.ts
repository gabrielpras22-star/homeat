import { admin, handle, HttpError, readJson, requireUser } from '@/lib/server/clients'
import { notifyMessage } from '@/lib/server/notify'

/**
 * Prévient le destinataire d'un nouveau message par email.
 * Anti-spam : un seul email par conversation toutes les 15 minutes.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const { message_id } = await readJson<{ message_id: string }>(request)
    if (!message_id) throw new HttpError(400, 'Message introuvable.')
    const db = admin()
    const { data: msg } = await db.from('messages').select('id, sender_id, receiver_id, content, created_at').eq('id', message_id).maybeSingle()
    if (!msg || msg.sender_id !== user.id) throw new HttpError(404, 'Message introuvable.')

    const since = new Date(new Date(msg.created_at).getTime() - 15 * 60_000).toISOString()
    const { count } = await db.from('messages').select('id', { count: 'exact', head: true })
      .eq('sender_id', msg.sender_id).eq('receiver_id', msg.receiver_id)
      .gte('created_at', since).lt('created_at', msg.created_at)
    if ((count ?? 0) > 0) return { sent: false }

    await notifyMessage(msg.sender_id, msg.receiver_id, msg.content)
    return { sent: true }
  })
}
