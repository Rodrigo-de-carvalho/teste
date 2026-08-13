// Retorna a data local no formato YYYY-MM-DD sem converter para UTC
export function localIso(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// Um passo de recorrência sobre um Date (mutação in-place). Retorna false se inválida.
function stepDate(d, recurrence, recurrenceDays) {
  if (recurrence === 'daily')        d.setDate(d.getDate() + 1)
  else if (recurrence === 'weekly')  d.setDate(d.getDate() + 7)
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'custom') {
    const days = Array.isArray(recurrenceDays) ? recurrenceDays : []
    // Sem dias configurados: comporta-se como 'daily' para não quebrar nada.
    if (days.length === 0) {
      d.setDate(d.getDate() + 1)
    } else {
      // Avança dia a dia (máx. 7) até cair num dia da semana selecionado.
      for (let i = 0; i < 7; i++) {
        d.setDate(d.getDate() + 1)
        if (days.includes(d.getDay())) break
      }
    }
  }
  else return false
  return true
}

// Avança uma data "YYYY-MM-DD" conforme a recorrência. Retorna nova string ou null.
// recurrenceDays: array de números 0-6 (Dom=0..Sáb=6), usado quando recurrence === 'custom'.
// Catch-up: se a data estiver no passado (tarefa atrasada), avança quantos passos
// forem necessários até hoje ou depois — antes, concluir uma diária vencida há um mês
// criava a próxima ocorrência ainda no passado e a série ficava eternamente atrasada.
export function advanceDate(iso, recurrence, recurrenceDays) {
  if (!iso || !recurrence || recurrence === 'none') return null
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  if (!stepDate(d, recurrence, recurrenceDays)) return null
  const today = localIso()
  let guard = 0
  while (localIso(d) < today && guard < 400) {
    if (!stepDate(d, recurrence, recurrenceDays)) return null
    guard++
  }
  return localIso(d)
}

export const RECURRENCE_OPTIONS = [
  { value: 'none',    label: 'Não repetir'   },
  { value: 'daily',   label: 'Diariamente'   },
  { value: 'weekly',  label: 'Semanalmente'  },
  { value: 'monthly', label: 'Mensalmente'   },
  { value: 'custom',  label: 'Dias da semana' },
]

// Recorrência 'custom' exige ao menos um dia da semana selecionado.
export function recurrenceInvalid(form) {
  return form?.recurrence === 'custom'
    && (!Array.isArray(form.recurrenceDays) || form.recurrenceDays.length === 0)
}

export const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DAYS_FULL_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

export function todayString() {
  const d = new Date()
  return `${DAYS_FULL_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`
}

export function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(iso + 'T00:00:00')
  const diff = Math.round((target - today) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  if (diff < 0) return `Atrasado ${Math.abs(diff)}d`
  if (diff < 7) return `Em ${diff} dias`
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export function isOverdue(dueDate) {
  if (!dueDate) return false
  const today = new Date(); today.setHours(0,0,0,0)
  return new Date(dueDate + 'T00:00:00') < today
}

export function formatFocusTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

export function getWeekDays() {
  const today = new Date()
  const dow = today.getDay()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - dow + i)
    return {
      index: i,
      label: DAYS_PT[i],
      date: d.getDate(),
      isToday: i === dow,
      isoDate: localIso(d),
    }
  })
}

export function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      label: DAYS_PT[d.getDay()],
      isoDate: localIso(d),
    }
  })
}
