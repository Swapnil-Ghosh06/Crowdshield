# CrowdShield Dashboard

This is a **Next.js 16 App Router** project for the CrowdShield real-time monitoring and sales operations dashboard.

## Overview

- **Framework**: Next.js 16 (App Router) with React 19 and Tailwind CSS.
- **WebSocket Backend**: Connects to `ws://localhost:8000/ws/risk-events`, matching `pipeline/main.py`.
- **Port**: Default development server runs on `http://localhost:3000`.
- **Migration Note**: This Next.js project replaces the legacy Vite + React dashboard, which has been moved to `dashboard-vite-legacy/` for reference (safe to delete once verified).

## Development Commands

### Using pnpm
```bash
pnpm install   # Install dependencies
pnpm dev       # Start development server on port 3000
pnpm build     # Build for production
pnpm start     # Start production server
```

### Using npm
```bash
npm install    # Install dependencies
npm run dev    # Start development server on port 3000
npm run build  # Build for production
npm start      # Start production server
```
