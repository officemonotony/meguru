export type NotifyType =
  | 'new_order'
  | 'order_approved'
  | 'proposal_accepted'
  | 'proposal_rejected'

/**
 * サーバーレス関数経由でLINE通知を送信する。
 * 失敗しても例外を投げず、コンソールにエラーを出力するのみ。
 */
export async function sendNotification(
  type: NotifyType,
  recipientId: string,
  data: Record<string, string>
): Promise<void> {
  if (!recipientId) return
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, recipientId, data }),
    })
  } catch (e) {
    console.error('LINE通知送信エラー:', e)
  }
}
