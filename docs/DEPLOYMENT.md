# Production Deployment Guide — Treasure Hunt Arena

This guide provides end-to-end instructions for deploying Treasure Hunt Arena to a production cloud environment with high availability, security hardening, and zero-downtime operation.

---

## 1. Architecture Overview

Treasure Hunt Arena employs a decoupled production topology:

```
                      +-----------------------------+
                      |       Cloudflare DNS        |
                      |   (DDoS & SSL Termination)  |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
    +----------------------+                    +----------------------+
    |    Vercel Hosting    |                    |    Render / Railway  |
    |  Next.js App Router  |                    |  Express + Socket.IO |
    |      (Frontend)      |                    |      (Backend)       |
    +----------+-----------+                    +----------+-----------+
               |                                           |
               |                                           v
               |                                +----------------------+
               |                                |  Supabase PostgreSQL |
               |                                |   (Managed DB Pool)  |
               |                                +----------+-----------+
               v                                           |
    +----------------------+                               v
    |   Team & Admin Web   |                    +----------------------+
    |   Mobile / Desktop   |                    |   Judge0 CE Engine   |
    +----------------------+                    |  (Sandboxed Compiler)|
                                                +----------------------+
```

- **Frontend**: Next.js 14 (App Router) on **Vercel** with CDN edge caching and security headers.
- **Backend**: Node.js 22 LTS container on **Render** (Web Service) or **Railway** with persistent WebSocket support.
- **Database**: **Supabase** Managed PostgreSQL (v15+) with connection pooling (`pgbouncer` on port `6543`).
- **Code Execution**: **Judge0** Community Edition on Docker or managed via RapidAPI.

---

## 2. Prerequisites

1. Accounts on:
   - [Vercel](https://vercel.com)
   - [Render](https://render.com) or [Railway](https://railway.app)
   - [Supabase](https://supabase.com)
   - [RapidAPI](https://rapidapi.com) (for Judge0) or self-hosted Judge0 instance
2. Node.js v22+ and npm 10+ installed locally.
3. OpenSSL or Node.js for generating 256-bit cryptographically secure random secrets.

---

## 3. Step 1: Database Setup (Supabase)

1. Create a new Supabase project named `treasure-hunt-arena`.
2. Navigate to **Project Settings** > **Database** and copy the **Connection string** (URI mode, Transaction pooler, port `6543`).
3. Open the **SQL Editor** in Supabase and execute the migration files sequentially from `database/migrations/`:
   - `001_initial_schema.sql`
   - `002_v1_constraints_and_indexes.sql`
   - `003_v2_comprehensive_schema.sql`
   - `004_seed_demo_teams.sql`
4. Confirm all 16 tables are created: `events`, `admins`, `teams`, `team_members`, `team_sessions`, `locations`, `qr_tokens`, `rounds`, `riddles`, `coding_challenges`, `team_routes`, `team_progress`, `submissions`, `qr_scans`, `violations`, `audit_logs`.

---

## 4. Step 2: Backend API Deployment (Render / Railway)

### Option A: Render Deployment via Blueprint
1. Connect your repository to Render.
2. Select **New** > **Blueprint** and reference the repository root containing [`render.yaml`](file:///home/arjun0r1gin/Desktop/DAVID/render.yaml).
3. Set the required secret environment variables:
   - `JWT_SECRET`: 64-character random string (`openssl rand -hex 32`)
   - `COOKIE_SECRET`: 64-character random string (`openssl rand -hex 32`)
   - `DATABASE_URL`: Your Supabase PostgreSQL connection string.
   - `CORS_ORIGIN`: Your production Vercel frontend URL (e.g. `https://arena.yourdomain.com`).
   - `JUDGE0_API_KEY`: Your RapidAPI Judge0 key.
4. Click **Apply**. Render will build the container using `apps/api/Dockerfile` or npm workspace build scripts.
5. Verify deployment: `curl -f https://<your-render-url>/api/v1/health`.

### Option B: Railway Deployment
1. Click **New Project** > **Deploy from GitHub repo**.
2. Railway detects [`railway.json`](file:///home/arjun0r1gin/Desktop/DAVID/railway.json) and builds using `apps/api/Dockerfile`.
3. Add the environment variables listed in `.env.production.example`.
4. Deploy and verify the `/api/v1/health` endpoint.

---

## 5. Step 3: Frontend Web Deployment (Vercel)

1. Import your repository into Vercel.
2. Set the **Root Directory** to `apps/web`.
3. Build & Development Settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
4. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://<your-backend-domain>/api/v1`
   - `NEXT_PUBLIC_SOCKET_URL`: `https://<your-backend-domain>`
   - `NEXT_PUBLIC_EVENT_NAME`: `Treasure Hunt Championship Arena`
5. Click **Deploy**. Vercel will build the Next.js bundle and deploy to global edge nodes.
6. Once deployed, update the `CORS_ORIGIN` variable on your backend to match the assigned Vercel domain.

---

## 6. Step 4: Health Checks & Production Verification

1. **API Health**:
   ```bash
   curl -I https://<your-backend-domain>/api/v1/health
   # Expected: HTTP/2 200 OK
   ```
2. **WebSocket Handshake**:
   - Verify WebSocket connection over WSS (`wss://<your-backend-domain>/socket.io/?token=...`).
3. **Camera & Device Binding**:
   - Access `https://<your-frontend-domain>/arena` on mobile device and grant camera permissions for physical QR scanning.
4. **Admin Dashboard**:
   - Access `https://<your-frontend-domain>/admin` and log in with organizer credentials.

---

## 7. Security Hardening Checklist

- [x] HTTPS enforced with TLS 1.3 across all subdomains.
- [x] HTTP-only, Secure, SameSite=Lax flags on session cookies.
- [x] CORS restricted to exact Vercel frontend domain.
- [x] Camera access explicitly restricted to `self` in `Permissions-Policy`.
- [x] Rate limiting configured on `/api/v1/auth/*` and code execution endpoints.
- [x] Database queries parameterized with zero dynamic SQL concatenation.
- [x] Cryptographic salt enforced on all QR token verification routines.
