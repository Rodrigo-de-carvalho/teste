import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

const router = Router()

// Todas as rotas requerem autenticação
router.use(requireAuth)

// ── GET /tasks — listar todas as tarefas do usuário ───────────────────────
router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where:   { userId: req.user.id },
      include: { subtasks: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar tarefas' })
  }
})

// ── POST /tasks — criar tarefa ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, notes, priority, project, dueDate, dueTime, weekDay, subtasks } = req.body

    if (!title?.trim()) return res.status(400).json({ error: 'Título obrigatório' })

    const task = await prisma.task.create({
      data: {
        title:    title.trim(),
        notes:    notes || '',
        priority: priority || 'medium',
        project:  project || 'Geral',
        dueDate:  dueDate || null,
        dueTime:  dueTime || null,
        weekDay:  weekDay ?? null,
        userId:   req.user.id,
        subtasks: subtasks?.length
          ? { create: subtasks.map(s => ({ title: s.title, done: s.done || false })) }
          : undefined,
      },
      include: { subtasks: true },
    })
    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar tarefa' })
  }
})

// ── PATCH /tasks/:id — atualizar tarefa ───────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    // Verifica ownership
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (!existing) return res.status(404).json({ error: 'Tarefa não encontrada' })

    const { subtasks, ...data } = req.body

    // Converte completedAt se completing
    if (data.completed === true && !existing.completed) {
      data.completedAt = new Date()
    } else if (data.completed === false) {
      data.completedAt = null
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: { subtasks: true },
    })
    res.json(task)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar tarefa' })
  }
})

// ── DELETE /tasks/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (!existing) return res.status(404).json({ error: 'Tarefa não encontrada' })

    await prisma.task.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar tarefa' })
  }
})

// ── PATCH /tasks/:id/subtasks/:subId ─────────────────────────────────────
router.patch('/:id/subtasks/:subId', async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' })

    const subtask = await prisma.subtask.update({
      where: { id: req.params.subId },
      data:  { done: req.body.done },
    })
    res.json(subtask)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar subtarefa' })
  }
})

export default router
