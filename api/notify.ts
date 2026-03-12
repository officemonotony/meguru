import { createClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'http'

// ========== 型定義 ==========
export type NotifyType =
  | 'new_order'
  | 'order_approved'
  | 'proposal_accepted'
  | 'proposal_rejected'

interface NotifyPayload {
  type: NotifyType
  recipientId: string
  data: Record<string, string>
}

// ========== 通知メッセージテンプレート ==========
const messageTemplates: Record<NotifyType, (d: Record<string, string>) => string> = {
  new_order: (d) =>
    `【新規注文 🛒】\n${d.restaurantName}から注文が届きました。\n\n商品: ${d.productName}\n配送希望日: ${d.deliveryDate}\n\nメグルアプリで確認してください。`,
  order_approved: (d) =>
    `【注文承認 ✅】\n${d.farmerName}が注文を承認しました。\n\n商品: ${d.productName}\n配送日: ${d.deliveryDate}\n\nメグルアプリで詳細を確認してください。`,
  proposal_accepted: (d) =>
    `【継続提案 承認 🎉】\n${d.farmerName}が継続提案を承認しました。\n\n商品: ${d.productName}\n\n取引が開始されます。メグルアプリで確認してください。`,
  proposal_rejected: (d) =>
    `【継続提案 お断り】\n${d.farmerName}から継続提案のお断りが届きました。\n\n商品: ${d.productName}\n\n内容を確認し、再提案をご検討ください。`,
}

// ========== LINE Push Message ==========
async function sendLineMessage(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE API error ${res.status}: ${body}`)
  }
}

// ========== Vercel サーバーレスハンドラー ==========
export default async function handler(
  req: IncomingMessage & { body?: NotifyPayload },
  res: ServerResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const payload = req.body
  if (!payload?.type || !payload?.recipientId) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing required fields: type, recipientId' }))
    return
  }

  const { type, recipientId, data } = payload

  // Supabase service role クライアント（RLS をバイパスして line_user_id を取得）
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Supabase env vars not configured' }))
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('line_user_id')
    .eq('id', recipientId)
    .single()

  if (error) {
    console.error('profile fetch error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to fetch profile' }))
    return
  }

  // LINE IDが未登録の場合はスキップ（エラーではない）
  if (!profile?.line_user_id) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ skipped: true, reason: 'no_line_user_id' }))
    return
  }

  const template = messageTemplates[type]
  if (!template) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Unknown notification type: ${type}` }))
    return
  }

  try {
    await sendLineMessage(profile.line_user_id, template(data))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  } catch (e) {
    console.error('LINE send error:', e)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to send LINE message' }))
  }
}
