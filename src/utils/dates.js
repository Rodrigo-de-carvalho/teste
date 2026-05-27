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
      isoDate: d.toISOString().split('T')[0],
    }
  })
}

export function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      label: DAYS_PT[d.getDay()],
      isoDate: d.toISOString().split('T')[0],
    }
  })
}
