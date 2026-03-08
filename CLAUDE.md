# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint check
```

No test runner is configured yet.

## Architecture

APEX is an AI-powered job application assistant for students, built with React + Vite + Tailwind CSS v4.

**Routing** (`src/App.jsx`): React Router v6 with two top-level layouts:
- Public routes: `/` (Landing), `/login` (LoginRegister)
- Protected layout: `/dashboard/*` wraps all app pages in `DashboardLayout` (sidebar + `<Outlet>`)

**Dashboard pages** live under `src/pages/`:
- `Dashboard` — overview stats and quick actions
- `Discover` — job listings with AI match scores
- `TailoringLab` — CV/cover letter customization per application
- `Tracker` — application pipeline tracking

**Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`). Custom brand tokens are defined in `src/index.css` under `@theme`:
- `apex-blue` (#2563EB), `apex-cyan` (#38BDF8), `apex-bg` (#F8FAFC), `apex-text` (#0F172A), `apex-muted` (#64748B)

Use these tokens (e.g. `text-apex-muted`, `bg-apex-bg`) rather than raw hex values throughout the UI.

**Components**: `src/components/` contains only `Logo`, `Sidebar`, and `DashboardLayout`. Inline SVG icons (heroicons path data) are used directly rather than an icon library.
