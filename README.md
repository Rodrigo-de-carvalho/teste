# 🔥 Forge — Gerenciador de Tarefas

App de produtividade com design premium, dark mode e sincronização em nuvem.

## Stack

| Camada   | Tecnologia |
|----------|------------|
| Frontend | React + Vite + Tailwind CSS + Framer Motion |
| Backend  | Node.js + Express + Passport.js (Google OAuth) |
| Banco    | PostgreSQL (Railway) |
| ORM      | Prisma |
| Deploy FE | Vercel |
| Deploy BE | Railway |

## Setup local

### Frontend
```bash
cp .env.example .env   # edite VITE_API_URL se necessário
npm install && npm run dev
```

### Backend (pasta forge-api)
```bash
cp .env.example .env   # preencha as variáveis
npm install
npm run db:push        # cria tabelas no banco
npm run dev
```

## Configurar Google OAuth

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. APIs e Serviços → Credenciais → **Criar ID de cliente OAuth 2.0**
3. Tipo: Aplicativo Web
4. Origens autorizadas: `http://localhost:3001` e URL do Railway em prod
5. URIs de redirecionamento: `http://localhost:3001/auth/google/callback`
6. Copie **Client ID** e **Client Secret** para o `.env` do backend

## Deploy Railway (Backend)

Variáveis de ambiente necessárias:
- `DATABASE_URL` — gerada automaticamente ao linkar o Postgres
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` = `https://sua-api.railway.app/auth/google/callback`
- `JWT_SECRET` = string aleatória longa
- `FRONTEND_URL` = `https://seu-app.vercel.app`

## Funcionalidades

- Login com Google OAuth 2.0
- Sync entre dispositivos em tempo real
- Dashboard com timer Pomodoro
- Captura rápida `Ctrl+K`
- Sistema de XP e níveis com animações
- Dark mode nativo
- Planejamento semanal drag & drop
- Insights e gráficos de produtividade
