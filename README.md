# 52 Logistics Hub

A demo recruiting website and operations portal for 52 Logistics, Inc.

## Stack

- TanStack Start with React 19 and TypeScript
- Tailwind CSS v4

## Data and backend

The demo data layer in `src/lib/mock` uses an in-memory dataset, persisted to browser `localStorage` so changes survive reloads. Server renders use a fresh copy of the seed data. Demo authentication and data are for demonstration only, not production security or shared persistence.

Supabase is planned as the real backend for authentication and persistent application data; the current demo does not use it as its data store.

## Development

Install dependencies with `npm install`, then start the development server with `npm run dev`. Run a production build with `npm run build`.
