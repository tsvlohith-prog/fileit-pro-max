# Fileit — Decentralized File Sharing & Collaborative Document Studio

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38b2ac.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Drizzle-336791.svg)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)

**Fileit** is a full-stack, decentralized web application for private file distribution, interactive PDF markup and collaboration, peer-to-peer data beam, and automated 72-hour self-dissolving rooms.

For the exhaustive technical specification, database blueprints, and operations manual, see **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## Key Features

### 📄 Collaborative PDF Studio & Markup Engine
- **Viewing Controls**: Native high-definition rendering with 50%–250% zoom, 90° continuous rotation, inverted dark reading mode, and instant browser print.
- **Interactive Tool Ribbon**: Precision text notes, multi-color highlighters, vector freehand pen, and instant approval stamps (`APPROVED`, `CONFIDENTIAL`, `REVIEWED`, `SIGNED`, `REJECTED`).
- **Burned-in Vector Export**: Uses `html2canvas` and `jsPDF` to flatten and burn annotations into exportable, pristine vector PDF documents.
- **Instant Vault Sync**: 1-click button to save the reviewed PDF back into the active room vault.

### 🌐 Peer-to-Peer Data Beam (WebRTC)
- Direct browser-to-browser file transfers via native WebRTC DataChannels.
- Zero-server transmission mode for complete confidentiality and zero server footprint.
- Built-in Radar Mesh for discovering nearby peers in active rooms.

### 🔒 Dual-Layer Password Protection
- **Folder / Room Locks**: Enforce password protection across an entire folder or room.
- **Per-File Overrides**: Granular custom password lock on individual files within a shared folder.
- **Glassmorphic Gateway**: Frosted-glass unlock modal that shields asset contents and masks direct storage paths until authentication.

### ⏳ Ephemeral 72-Hour Self-Dissolving Rooms
- **Automated Lifecycle**: Uploads and rooms dissolve automatically after 3 days (72 hours).
- **Star to Keep Forever**: Toggle the Star badge on any file or room to exempt it from TTL cleanup.
- **Automated Disk & DB Purge**: Background worker unlinks disk files and wipes expired database records automatically.

### 📤 Multi-App Export & Native OS Integration
- 1-click export to **WhatsApp**, **Telegram**, **Gmail**, and formatted Markdown snippets for **Slack** and **Teams**.
- Native OS Share Sheet integration (`navigator.share`) with binary attachment streaming.

### 📑 Comprehensive Multi-Format Previews
- Built-in dynamic studio viewers for **PDF**, **DOCX**, **XLSX**, **PPTX**, source code snippets, images, and audio/video media.

---

## System Architecture

```text
[Client Web Browser] 
    ├── PDF Studio (Canvas, Tool Ribbon, Overlay Annotation Layer)
    ├── Multi-App Export Modal (Native Share Sheet, WhatsApp, Telegram, Slack)
    ├── Glassmorphic Unlock Gateway (Password Prompt, Decrypt State)
    ├── P2P Radar Mesh (WebRTC DataChannels)
    └── Dynamic Island Dock (Minimized Bubble & Split-Screen Viewers)
             │
             │ HTTPS / REST API
             ▼
[Express API Gateway]
    ├── Authentication & Room Token Interceptor
    ├── 72-Hour TTL Expiration Filter & Background Purge Worker
    ├── Dual-Layer Password Guard (Parent Folder vs Child File)
    ├── Multipart Upload Stream Pipeline
    ├── ZIP Archiving Worker
    └── PDF Annotation Ephemeral Sync Store
             │
             ▼
[PostgreSQL Database] ─── FilesTable, FoldersTable, RoomsTable, TextMessagesTable
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18.3, TypeScript 5.9, Vite 6.0, Wouter, Tailwind CSS v4, Lucide React |
| **PDF & Canvas** | jsPDF 4.2, html2canvas 1.4, Native Vector Canvas |
| **Networking** | WebRTC DataChannels, TanStack Query 5, Axios / Custom Fetch |
| **Backend** | Node.js v22, Express 4.21, Pino Structured Logger, Multer, Archiver |
| **Database** | PostgreSQL, Drizzle ORM |
| **Storage** | Dual-mode resolver: Local disk storage (`uploads/`) or Supabase Object Storage |

---

## Project Structure

```text
fileit/
├── artifacts/
│   ├── api-server/         # Express API backend
│   │   ├── src/
│   │   │   ├── routes/     # files, rooms, convert, webrtc, health
│   │   │   ├── lib/        # fileStorage, supabaseStorage, logger
│   │   │   ├── app.ts      # Express application setup
│   │   │   └── cleanup.ts  # 72-hour TTL expiration purge worker
│   │   └── uploads/        # Local disk storage directory
│   └── fileit/             # React + Vite frontend application
│       ├── public/         # Static assets and icons
│       └── src/
│           ├── components/ # PDF Studio, P2P Beam, Modals, Dynamic Island
│           ├── hooks/      # React hooks (use-upload, use-toast, etc.)
│           ├── lib/        # Storage helpers, WebRTC mesh, recent files
│           └── pages/      # Home, Files, RoomView, TextStudio, Share
├── lib/
│   ├── api-client-react/   # Generated TanStack React Query API hooks
│   ├── api-spec/           # OpenAPI 3.0 specification & Orval configuration
│   ├── api-zod/            # Zod validation schemas derived from OpenAPI
│   └── db/                 # Drizzle ORM PostgreSQL schema & pool client
├── supabase/
│   └── schema.sql          # Supabase SQL schema & RLS rules
├── uploads/                # Root storage mount point
├── .env.example            # Environment configuration template
├── DOCUMENTATION.md        # Complete technical specification
├── package.json            # Monorepo workspace configuration
├── server.ts               # Production unified HTTP runner & static server
└── tsconfig.base.json      # Base TypeScript configuration
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ / v22 recommended)
- **PostgreSQL**: Local instance or Supabase database

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/fileit.git
cd fileit
npm install
```

### 3. Environment Configuration
Copy the template configuration file:
```bash
cp .env.example .env
```
Open `.env` and set your database connection:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fileit
VITE_STORAGE_PROVIDER=local
```
*(Optional Supabase Storage and Firebase Google Drive keys can be configured as documented in `.env.example`)*.

### 4. Database Setup
Push schema definitions to your PostgreSQL database:
```bash
npx drizzle-kit push
```
*(If using Supabase, you can also execute `supabase/schema.sql` directly in your Supabase SQL Editor).*

### 5. Running in Development Mode
To run both the backend API server and the Vite frontend concurrently:
```bash
# On Unix / Git Bash / WSL:
npm run dev

# Or run individual services:
npm run dev:server    # Starts API server on port 3001
npm run dev:client    # Starts Vite frontend on port 3000
```

### 6. Production Build & Deployment
Build the entire monorepo:
```bash
npm run build
```
Run the unified production server:
```bash
npm start
```
The application will be accessible at `http://localhost:3000`.

---

## REST API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/files` | List active, unexpired files |
| `GET` | `/api/files/:id` | Retrieve file metadata |
| `GET` | `/api/files/:id/download` | Stream / download file contents |
| `POST` | `/api/upload` | Multipart file upload |
| `POST` | `/api/files/:id/unlock` | Decrypt locked file with password |
| `PUT` | `/api/files/:id/password` | Set or update password lock |
| `PUT` | `/api/files/:id/star` | Toggle star status (exempt from 72h TTL) |
| `DELETE`| `/api/files/:id` | Purge file record and storage file |
| `POST` | `/api/rooms/create` | Create a self-dissolving room |
| `POST` | `/api/rooms/join` | Join and authenticate into a room |
| `GET` | `/api/rooms/:id` | Get room metadata and assets |
| `GET` | `/api/rooms/:id/download` | Download all room files as a `.zip` |

For full endpoint schemas and parameter requirements, refer to **[DOCUMENTATION.md](./DOCUMENTATION.md)** or `lib/api-spec/openapi.yaml`.

---

## Security & Privacy

1. **Zero Cold Footprint**: Unstarred assets and dissolved rooms are automatically erased from both database and disk upon expiry.
2. **Defensive API Sanitation**: Locked resources strip sensitive metadata (`storagePath`) in responses until valid password authentication is passed.
3. **No External Trackers**: Operates without third-party tracking scripts or advertising cookies.
4. **Direct P2P Option**: Supports WebRTC Beam for zero-server direct transfers between devices.

---

## License

Copyright © 2026 Fileit. All rights reserved.  
Proprietary software. Unauthorized copying, distribution, or modification is strictly prohibited.
