// Geração de evento de calendário (.ics) — funciona em Android e iPhone.
// O .ics inclui um VALARM, então o evento entra no calendário do celular já
// com o lembrete/alarme nativo do aparelho (não depende de push web).

function pad(n) { return String(n).padStart(2, '0') }

// Escapa texto conforme RFC 5545 (vírgula, ponto-e-vírgula, barra, quebra de linha)
function esc(text = '') {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// "YYYY-MM-DD" + "HH:MM" → "YYYYMMDDTHHMMSS" (horário local flutuante)
function toIcsDateTime(dateStr, timeStr) {
  const [h, m] = (timeStr || '09:00').split(':')
  return `${dateStr.replace(/-/g, '')}T${pad(h)}${pad(m)}00`
}

function nowStampUtc() {
  const d = new Date()
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// Soma minutos a um "HH:MM" e devolve "HH:MM" (sem virar o dia, suficiente p/ default)
function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function buildTaskIcs(task) {
  if (!task?.dueDate) return null

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Forje//Tarefas//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${task.id}@forje.app`,
    `DTSTAMP:${nowStampUtc()}`,
  ]

  const hasTime = !!(task.startTime || task.dueTime)
  if (hasTime) {
    const start = task.startTime || task.dueTime
    const end   = task.dueTime && task.startTime
      ? task.dueTime
      : addMinutes(start, 60) // sem término definido → 1h de duração
    lines.push(`DTSTART:${toIcsDateTime(task.dueDate, start)}`)
    lines.push(`DTEND:${toIcsDateTime(task.dueDate, end)}`)
  } else {
    // Evento de dia inteiro
    const day = task.dueDate.replace(/-/g, '')
    const next = new Date(task.dueDate + 'T00:00:00')
    next.setDate(next.getDate() + 1)
    const nextDay = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
    lines.push(`DTSTART;VALUE=DATE:${day}`)
    lines.push(`DTEND;VALUE=DATE:${nextDay}`)
  }

  lines.push(`SUMMARY:${esc(task.title)}`)
  if (task.notes)   lines.push(`DESCRIPTION:${esc(task.notes)}`)
  if (task.project) lines.push(`CATEGORIES:${esc(task.project)}`)

  // Alarme nativo do calendário, conforme o lembrete escolhido na tarefa
  if (task.reminderOffset != null && hasTime) {
    const related = task.reminderAnchor === 'end' ? 'END' : 'START'
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(task.title)}`,
      `TRIGGER;RELATED=${related}:-PT${task.reminderOffset}M`,
      'END:VALARM',
    )
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

// Baixa/abre o .ics — no celular, o sistema oferece adicionar ao calendário
export function addTaskToCalendar(task) {
  const ics = buildTaskIcs(task)
  if (!ics) return false
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(task.title || 'tarefa').replace(/[^\w-]+/g, '_').slice(0, 40)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
