# doomscrolling-tracker-backend

This is the backend project using ExpressJS, PostgreSQL, and Prisma for the doomscrolling tracker application.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The server starts at `http://localhost:3000` by default.

## Environment

Set `DATABASE_URL` in `.env` to your PostgreSQL connection string:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/doomscrolling_tracker?schema=public"
```

## Useful Scripts

- `npm run dev` - start the API with file watching
- `npm start` - start the API
- `npm run typecheck` - run TypeScript checks
- `npm run prisma:generate` - generate the Prisma client
- `npm run prisma:migrate` - create and apply a development migration
- `npm run prisma:studio` - open Prisma Studio

## Health Checks

- `GET /health` - API health
- `GET /health/db` - PostgreSQL connectivity through Prisma
