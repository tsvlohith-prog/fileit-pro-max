# Fileit — Complete Technical Specification & Operations Manual

## Executive Summary
**Fileit** is a full-stack, decentralized web application for private file distribution, interactive PDF markup and collaboration, peer-to-peer data beam, and automated 3-day self-dissolving rooms.

This manual provides an in-depth reference of all architectural layers, database schemas, security models, PDF rendering logic, and deployment workflows.

---

## 1. System Architecture

### 1.1 Technology Stack
- **Frontend Framework**: React 18.3 with TypeScript 5.9, bundled via Vite 6.0
- **Routing**: Wouter lightweight client-side router
- **Styling**: Tailwind CSS v4 with glassmorphism, zero-pill aesthetic discipline, and dark/light adaptive contrast
- **Icons**: Lucide React and React Icons
- **PDF Engine**: Native vector iframe canvas + jsPDF 4.2 + html2canvas 1.4 for burned-in annotation flattening
- **P2P Transport**: Native WebRTC DataChannels with fallback room mesh synchronization
- **Backend Server**: Node.js v22 + Express 4.21 with Pino structured logging
- **Database**: PostgreSQL with Drizzle ORM schemas
- **Storage Layer**: Dual-mode file stream resolver (Local high-performance disk storage + optional Supabase Object Storage)
- **Archive Engine**: Archiver streaming ZIP generation

### 1.2 Data Flow & Component Model
```text
[Client Web Browser] 
    ├── PDF Studio (Viewport Canvas, Tool Ribbon, Overlay Layer)
    ├── Multi-App Export Modal (Native Share Sheet, WhatsApp, Telegram, Slack)
    ├── Glassmorphic Unlock Gateway (Password Prompt, Decrypt State)
    ├── P2P Radar Mesh (WebRTC DataChannels)
    └── Dynamic Island Dock (Minimized Bubble & Split-Screen Viewers)
             │
             │ HTTPS / REST API
             ▼
[Express API Gateway]
    ├── Authentication & Room Token Interceptor
    ├── 72-Hour TTL Expiration Filter
    ├── Dual-Layer Password Guard (Parent Folder vs Child File)
    ├── Multipart Upload Stream Pipeline
    ├── ZIP Archiving Worker
    └── PDF Annotation Ephemeral Sync Store
             │
             ▼
[PostgreSQL Database] ─── FilesTable, FoldersTable, RoomsTable, TextMessagesTable
```

---

## 2. Core Capabilities & Feature Deep-Dive

### 2.1 Collaborative PDF Studio & Markup Engine
- **Viewing Modes**: Native rendering with 50%–250% zoom scale, 90-degree continuous rotation, inverted night reading theme, and direct browser print trigger.
- **Interactive Tool Ribbon**:
  - **Text Annotations**: Precision floating text boxes with responsive positioning.
  - **Highlighter**: Multi-color translucent markers (Yellow, Emerald, Rose, Sky Blue, Purple).
  - **Preset Approval Stamps**: Instant official badges (`APPROVED`, `CONFIDENTIAL`, `REVIEWED`, `SIGNED`, `REJECTED`).
  - **Freehand Markup**: Touch and mouse vector drawing over documents.
- **Flattened Export**: Captures the rendered DOM layers and burns annotations into a new vector PDF file using `html2canvas` and `jsPDF`.
- **Vault Integration**: 1-click button to save the reviewed PDF directly back to the active room vault.

### 2.2 Multi-App Sharing & Native OS Integration
- **Direct App Targets**:
  - **WhatsApp**: Pre-formatted URL trigger with encoded message and document link.
  - **Telegram**: Instant forward link with title and metadata.
  - **Gmail**: Pre-filled email draft with subject and secure download link.
  - **Slack / Teams**: 1-click clipboard copy of formatted Markdown block.
- **Native OS Share Sheet**: Invokes `navigator.share` with file binary attachment and secure access token.

### 2.3 Dual-Layer Password Protection
- **Folder Locks**: Password encryption applied at the folder or room level. All files inside automatically inherit protection.
- **Per-File Overrides**: Individual files can specify custom passwords, allowing granular multi-tenant access within the same folder.
- **Glassmorphic Unlock Modal**: Non-authenticated visitors see a blurred preview backdrop with an animated frosted-glass unlock modal.
- **Zero Information Leakage**: Payload storage paths and file binary contents are withheld by API endpoints until valid credentials are provided.

### 2.4 Ephemeral 72-Hour Lifecycle
- **Default TTL**: All files and rooms have a default 3-day (72 hours) dissolution timestamp.
- **Keep Forever Toggle**: Users can "Star" documents to exempt them from automated dissolution.
- **Dissolve Timers**: Real-time remaining countdown badges display urgency when expiring within 12 hours.
- **Complete Purge**: Expired records and their physical disk files are permanently unlinked and wiped from storage.

---

## 3. Database Schema Reference

### 3.1 Files (`files`)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique file identifier |
| `original_name` | `text` | Original uploaded filename |
| `size` | `integer` | File size in bytes |
| `mime_type` | `text` | IANA MIME type |
| `storage_path` | `text` | Relative path in storage directory |
| `share_token` | `text` | Unique public share token |
| `folder_id` | `uuid` (FK) | Reference to parent folder (nullable) |
| `password` | `text` | Custom password lock (nullable) |
| `download_count`| `integer` | Total completed downloads |
| `is_starred` | `boolean` | Star flag exempting file from TTL |
| `expires_at` | `timestamp` | Ephemeral expiration date (default: now + 72h) |
| `created_at` | `timestamp` | Record creation timestamp |

### 3.2 Folders & Rooms (`folders`)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique folder / room identifier |
| `name` | `text` | Folder or Room name |
| `share_token` | `text` | Public share token |
| `password` | `text` | Folder password lock (nullable) |
| `expires_at` | `timestamp` | Ephemeral dissolution date |
| `created_at` | `timestamp` | Creation timestamp |

### 3.3 Text & Code Messages (`text_messages`)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Unique snippet identifier |
| `title` | `text` | Snippet title |
| `content` | `text` | Raw text or source code |
| `language` | `text` | Language (`javascript`, `python`, `markdown`, etc.) |
| `file_id` | `uuid` (FK) | Optional attachment to specific file |
| `folder_id` | `uuid` (FK) | Optional attachment to room/folder |
| `expires_at` | `timestamp` | Ephemeral dissolution date |
| `created_at` | `timestamp` | Creation timestamp |

---

## 4. REST API Endpoint Specifications

### 4.1 Document & File Endpoints
- `GET /api/files`: Returns active unexpired files.
- `GET /api/files/:id`: Returns file metadata (withholds `storagePath` if locked).
- `GET /api/files/:id/download`: Streams file with `Content-Disposition: inline` (or attachment with `?download=1`). Verifies password or share token.
- `POST /api/upload`: Multipart upload endpoint returning `{ storagePath, shareToken }`.
- `POST /api/files/:id/unlock`: Validates `{ password }` and returns full file object with decrypted `storagePath`.
- `PUT /api/files/:id/password`: Sets, updates, or removes password lock.
- `PUT /api/files/:id/star`: Toggles star status.
- `DELETE /api/files/:id`: Purges file record and disk storage.

### 4.2 Room Collaboration Endpoints
- `POST /api/rooms/create`: Creates a new password-protected room.
- `POST /api/rooms/join`: Authenticates user into room and returns room token.
- `GET /api/rooms/:id`: Returns room metadata, files, and snippets.
- `POST /api/rooms/:id/files`: Accepts multipart file uploads directly to room vault.
- `GET /api/rooms/:id/download`: Streams a `.zip` archive containing all room files.
- `GET /api/rooms/:id/pdf-annotations/:fileId`: Retrieves stored PDF annotations.
- `POST /api/rooms/:id/pdf-annotations/:fileId`: Saves collaborative PDF annotations.
- `GET /api/rooms/:id/canvas`: Retrieves whiteboard vector canvas state.
- `POST /api/rooms/:id/canvas`: Saves whiteboard vector canvas state.
- `GET /api/rooms/:id/document`: Retrieves collaborative markdown scratchpad.
- `PUT /api/rooms/:id/document`: Updates collaborative markdown scratchpad.
- `DELETE /api/rooms/:id`: Permanently dissolves room and purges all assets.

---

## 5. Security & Privacy Guarantees

1. **Zero Cold Footprint**: Unstarred assets and dissolved rooms are purged completely from both database and disk upon expiry.
2. **Defensive API Sanitation**: Locked resources omit sensitive attributes (`storagePath`) in responses to prevent direct unauthorized access.
3. **No External Trackers**: Fileit operates without external analytics, trackers, or cookies.
4. **Direct P2P Option**: Users seeking zero-server file transfer can utilize the WebRTC Beam feature for browser-to-browser transmission.

---

## 6. License & Copyright

**Copyright © 2026 Fileit. All rights reserved.**

This software, its source code, database blueprints, architecture specifications, and documentation are strictly private and proprietary. No part of this codebase may be distributed, shared, sublicensed, or used in open-source derivative works without express written consent.
