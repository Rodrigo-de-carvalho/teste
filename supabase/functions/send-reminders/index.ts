import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @deno-types="npm:@types/web-push"
import webpush from 'npm:web-push'

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails('mailto:admin@forje.app', VAPID_PUBLIC, VAPID_PRIVATE)

const PRIORITY_LABEL: Record<string, string> = {
  critical: '🚨 Urgente',
  high:     '🔴 Alta prioridade',
  medium:   '🟡 Média prioridade',
  low:      '🟢 Baixa prioridade',
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: tasks, error } = await supabase.rpc('get_due_reminder_tasks')

  if (error) {
    console.error('[send-reminders] erro ao buscar tarefas:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const results: { taskId: string; status: string; error?: string }[] = []

  for (const task of (tasks ?? [])) {
    const title = `⏰ ${task.title}`
    const body  = task.due_time
      ? `${PRIORITY_LABEL[task.priority] ?? ''} · vence às ${task.due_time}`
      : (PRIORITY_LABEL[task.priority] ?? '')

    const subscription = {
      endpoint: task.endpoint,
      keys: { p256dh: task.p256dh, auth: task.auth_key },
    }

    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body, tag: task.task_id, taskId: task.task_id })
      )
      await supabase
        .from('tasks')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', task.task_id)
      results.push({ taskId: task.task_id, status: 'sent' })
    } catch (err: unknown) {
      const e = err as { statusCode?: number }
      results.push({ taskId: task.task_id, status: 'failed', error: String(err) })
      // Subscription expirada ou inválida — remove para não tentar de novo
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', task.endpoint)
      }
    }
  }

  console.log(`[send-reminders] ${results.length} lembretes processados`)
  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
