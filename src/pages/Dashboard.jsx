import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import ProgressRing from '../components/ui/ProgressRing'
import TaskCard from '../components/tasks/TaskCard'
import { formatFocusTime, todayString } from '../utils/dates'

const DURATION_OPTIONS = [15, 25, 45, 60]

// Estágios da planta — estilo Forest
const PLANT_STAGES = [
  { minPct: 0,   emoji: '🌱', label: 'Pronta para crescer' },
  { minPct: 1,   emoji: '🌱', label: 'Brotando...' },
  { minPct: 25,  emoji: '🌿', label: 'Crescendo...' },
  { minPct: 55,  emoji: '🌳', label: 'Quase lá!' },
  { minPct: 85,  emoji: '🌲', label: 'Resistindo!' },
]

function getPlant(pct, dead) {
  if (dead) return { emoji: '🥀', label: 'Murcha. Tente de novo!' }
  const stage = [...PLANT_STAGES].reverse().find(s => pct >= s.minPct)
  return stage || PLANT_STAGES[0]
}

// XP que será ganho ao completar (para exibir antecipadamente)
function previewXp(minutes, sessionStreak) {
  const multiplier = Math.min(2, 1 + (sessionStreak - 1) * 0.25)
  return Math.round(minutes * multiplier)
}

export default function Dashboard() {
  const {
    user, getXpProgress, getFocusTask, getActiveTasks, getCompletedToday,
    setFocusTask, completeFocusSession, tasks, setQuickCaptureOpen,
  } = useStore()

  const xp        = getXpProgress()
  const focusTask = getFocusTask()
  const active    = getActiveTasks()
  const doneToday = getCompletedToday()

  const [timerMinutes, setTimerMinutes] = useState(25)
  const [timerSec, setTimerSec]         = useState(25 * 60)
  const [running,  setRunning]          = useState(false)
  const [sessions, setSessions]         = useState(0)   // sessões consecutivas concluídas
  const [plantDead, setPlantDead]       = useState(false)
  const [abandonWarning, setAbandonWarning] = useState(false)
  const intervalRef = useRef(null)

  function selectDuration(min) {
    if (running) return
    setTimerMinutes(min)
    setTimerSec(min * 60)
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimerSec(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            setSessions(n => {
              const next = n + 1
              completeFocusSession(timerMinutes, next)
              return next
            })
            return timerMinutes * 60
          }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, completeFocusSession, timerMinutes])

  function handleResetClick() {
    if (running) {
      setAbandonWarning(true)
    } else {
      doReset()
    }
  }

  function doReset() {
    setRunning(false)
    setTimerSec(timerMinutes * 60)
    setAbandonWarning(false)
  }

  function confirmAbandon() {
    setSessions(0)         // zera streak ao abandonar
    setPlantDead(true)
    doReset()
    setTimeout(() => setPlantDead(false), 3000)
  }

  const totalSec  = timerMinutes * 60
  const elapsed   = totalSec - timerSec
  const timerPct  = Math.round((elapsed / totalSec) * 100)
  const mm = String(Math.floor(timerSec / 60)).padStart(2, '0')
  const ss = String(timerSec % 60).padStart(2, '0')

  const plant        = getPlant(running || timerPct > 0 ? timerPct : 0, plantDead)
  const nextSessions = sessions + 1
  const multiplier   = Math.min(2, 1 + sessions * 0.25)
  const xpPreview    = previewXp(timerMinutes, nextSessions)

  const nextTasks = active.filter(t => t.id !== focusTask?.id).slice(0, 3)

  const projectMap = {}
  active.forEach(t => { projectMap[t.project] = (projectMap[t.project] || 0) + 1 })
  const projects = Object.entries(projectMap).slice(0, 4)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <section className="mb-10">
        <p className="font-label text-primary text-xs font-semibold tracking-[0.2em] uppercase mb-1">
          {todayString()}
        </p>
        <h2 className="font-display font-bold text-on-surface text-4xl md:text-5xl tracking-tight">
          {greeting()}, {user.name}
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-md">
          {active.length > 0
            ? `Você tem ${active.length} tarefa${active.length > 1 ? 's' : ''} pendente${active.length > 1 ? 's' : ''}. ${running ? 'Foco total! 🔥' : 'Pronto para forjar o dia?'}`
            : 'Tudo limpo! Ótimo trabalho hoje. 🎉'
          }
        </p>
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Focus Card (8 cols) ── */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass rounded-2xl p-6 md:p-8 border border-white/60 shadow-card relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/6 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

            {focusTask ? (
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="chip bg-primary/10 text-primary">Foco Principal</span>
                  {focusTask.project && (
                    <>
                      <span className="text-on-surface-variant/30">•</span>
                      <span className="text-on-surface-variant text-xs font-label">{focusTask.project}</span>
                    </>
                  )}
                </div>

                <h3 className="font-display font-bold text-on-surface text-2xl md:text-3xl mb-5 leading-snug tracking-tight max-w-lg">
                  {focusTask.title}
                </h3>

                {/* Duration selector — visível só quando parado */}
                {!running && !abandonWarning && (
                  <div className="flex gap-2 mb-5">
                    <span className="text-on-surface-variant/60 text-xs font-label self-center mr-1">Duração:</span>
                    {DURATION_OPTIONS.map(min => (
                      <button
                        key={min}
                        onClick={() => selectDuration(min)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-label font-semibold transition-all
                          ${timerMinutes === min
                            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                            : 'text-on-surface-variant hover:bg-secondary-container/50'
                          }`}
                      >
                        {min}m
                      </button>
                    ))}
                  </div>
                )}

                {/* Aviso de abandono */}
                <AnimatePresence>
                  {abandonWarning && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mb-5 rounded-2xl p-4 border border-error/30 flex flex-col gap-3"
                      style={{ background: 'rgba(211,47,47,0.06)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🥀</span>
                        <div>
                          <p className="font-semibold text-on-surface text-sm">Sua árvore vai murchar!</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Você vai perder o progresso e o streak de {sessions} sessão{sessions !== 1 ? 'ões' : ''} vai zerar.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAbandonWarning(false)}
                          className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-semibold transition-all hover:opacity-90"
                        >
                          Continuar focando
                        </button>
                        <button
                          onClick={confirmAbandon}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold text-error transition-all hover:bg-error/10"
                          style={{ border: '1px solid rgba(211,47,47,0.3)' }}
                        >
                          Abandonar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  {/* Timer + Planta */}
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <ProgressRing pct={timerPct} size={110} stroke={5} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {plantDead ? (
                          <span className="text-3xl">🥀</span>
                        ) : running || timerPct > 0 ? (
                          <>
                            <motion.span
                              key={plant.emoji}
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-2xl leading-none"
                            >
                              {plant.emoji}
                            </motion.span>
                            <span className="font-display font-bold text-primary text-lg leading-tight">{mm}:{ss}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-display font-bold text-primary text-2xl leading-none">{mm}:{ss}</span>
                            <span className="text-on-surface-variant/60 text-[10px] font-label mt-0.5">{timerMinutes} min</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-on-surface text-lg">{plantDead ? 'Sessão interrompida' : plant.label}</p>
                      <p className="text-on-surface-variant text-sm">
                        {plantDead ? 'A planta murchou 🥀' : `Sessão ${nextSessions} de foco`}
                      </p>
                      <p className="text-on-surface-variant/60 text-xs mt-1">
                        Total hoje: {formatFocusTime(user.todayFocusSec)}
                      </p>
                      {/* XP preview + streak */}
                      {!plantDead && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-primary/80 text-xs font-label font-semibold">
                            +{xpPreview} XP ao concluir
                          </span>
                          {sessions > 0 && (
                            <span className="text-[10px] font-label px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                              ×{multiplier.toFixed(2).replace(/\.?0+$/, '')} streak
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  {!abandonWarning && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleResetClick}
                        title={running ? 'Abandonar sessão' : 'Reiniciar'}
                        className="w-10 h-10 rounded-full border border-outline-variant text-on-surface-variant
                                   flex items-center justify-center hover:bg-secondary-container/40 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">replay</span>
                      </button>
                      <button
                        onClick={() => setRunning(r => !r)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-label font-semibold text-sm
                                    transition-all duration-200 active:scale-95 shadow-primary-glow
                                    ${running
                                      ? 'bg-on-surface text-surface hover:opacity-90'
                                      : 'bg-primary text-white hover:opacity-90 animate-pulse-violet'
                                    }`}
                      >
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {running ? 'pause' : 'play_arrow'}
                        </span>
                        {running ? 'Pausar' : 'Iniciar Foco'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Dica de streak quando houver sessões */}
                {sessions > 0 && !running && !plantDead && (
                  <p className="mt-4 text-xs text-primary/70 font-label text-center">
                    🔥 {sessions} sessão{sessions !== 1 ? 'ões' : ''} consecutiva{sessions !== 1 ? 's' : ''} — próxima rende {xpPreview} XP (×{multiplier.toFixed(2).replace(/\.?0+$/, '')})
                  </p>
                )}
              </div>
            ) : (
              <div className="relative z-10 text-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-primary text-[28px]">bolt</span>
                </div>
                <p className="font-display font-semibold text-on-surface text-xl mb-2">Sem tarefa em foco</p>
                <p className="text-on-surface-variant text-sm mb-6">Escolha uma tarefa abaixo ou crie uma nova</p>
                <button onClick={() => setQuickCaptureOpen(true)} className="btn-primary mx-auto">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Nova tarefa
                </button>
              </div>
            )}
          </div>

          {/* Next tasks */}
          {nextTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-semibold text-on-surface">Próximas Intenções</h4>
                <button onClick={() => useStore.getState().setPage('inbox')}
                  className="text-primary text-sm font-label hover:underline">
                  Ver todas
                </button>
              </div>
              <div className="space-y-2">
                {nextTasks.map(t => (
                  <div key={t.id} className="relative group">
                    <TaskCard task={t} compact />
                    {t.id !== focusTask?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setFocusTask(t.id) }}
                        className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
                                   text-xs font-label text-primary hover:underline transition-opacity hidden md:block"
                      >
                        Focar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column (4 cols) ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Stats Card */}
          <div className="glass rounded-2xl p-6 border border-white/60 shadow-card">
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-display font-semibold text-on-surface">Estado de Fluxo</h4>
              <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                analytics
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Concluídas hoje', value: doneToday.length, icon: 'task_alt' },
                { label: 'Pendentes',       value: active.length,    icon: 'pending_actions' },
                { label: 'Foco hoje',       value: formatFocusTime(user.todayFocusSec) || '0m', icon: 'timer' },
                { label: 'Streak',          value: `${user.streak}🔥`, icon: 'local_fire_department' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--clr-white-card) 80%, transparent)' }}>
                  <span className="material-symbols-outlined text-primary/70 text-[16px] mb-1 block">{icon}</span>
                  <p className="font-display font-bold text-primary text-xl leading-none">{value}</p>
                  <p className="text-on-surface-variant text-[10px] font-label mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* XP progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-label text-on-surface-variant">Nível {xp.level}</span>
                <span className="text-xs font-label text-primary font-semibold">{xp.pct}%</span>
              </div>
              <div className="h-2 w-full bg-secondary-container rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${xp.pct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[10px] text-on-surface-variant/60 font-label mt-1">
                {xp.earned}/{xp.needed} XP para nível {xp.level + 1}
              </p>
            </div>
          </div>

          {/* Projects */}
          {projects.length > 0 && (
            <div className="forge-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-label font-semibold text-on-surface-variant text-xs tracking-widest uppercase">
                  Projetos Ativos
                </h4>
                <button
                  onClick={() => setQuickCaptureOpen(true)}
                  className="text-primary hover:bg-primary/10 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
              <ul className="space-y-3">
                {projects.map(([name, count], i) => (
                  <li key={name} className="flex items-center gap-3 group cursor-pointer"
                      onClick={() => useStore.getState().setPage('inbox')}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0
                      ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-tertiary' : i === 2 ? 'bg-success' : 'bg-outline'}`} />
                    <span className="text-on-surface text-sm group-hover:text-primary transition-colors flex-1 truncate">
                      {name || 'Geral'}
                    </span>
                    <span className="text-on-surface-variant/50 text-xs font-label">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Focus task selector */}
          {active.length > 1 && (
            <div className="forge-card rounded-2xl p-6">
              <h4 className="font-label font-semibold text-on-surface-variant text-xs tracking-widest uppercase mb-3">
                Mudar Foco
              </h4>
              <div className="space-y-2">
                {active.slice(0, 4).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setFocusTask(t.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center gap-2
                      ${t.id === focusTask?.id
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-on-surface hover:bg-secondary-container/50'
                      }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                      ${t.priority === 'critical' ? 'bg-error' : t.priority === 'high' ? 'bg-tertiary' : 'bg-primary'}`} />
                    <span className="truncate">{t.title}</span>
                    {t.id === focusTask?.id && (
                      <span className="material-symbols-outlined text-[14px] ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
