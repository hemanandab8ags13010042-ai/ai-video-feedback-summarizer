# DigiQuest Studio - AI Video Feedback Summarizer

An enterprise-grade SaaS production management application designed for film studios, video editors, VFX teams, and content creators. It automates client feedback ingestion, transcribes audio/video comments, runs sentiment risk assessments, and automatically populates Kanban task cards with team assignment recommendations.

---

## Key Features

1. **AI Feedback Analyzer (Gemini / OpenAI)**: Supports drag-and-drop feedback for text, PDFs, DOCX, TXT, and audio voice notes (MP3, WAV). Dispatches files directly to Gemini for transcription and analysis.
2. **Workload Task Auto-Seeding**: The AI categorizes adjustments as 'Editing' or 'VFX' tasks, estimates effort in hours, and matches assignments to staff based on active workload.
3. **Studio Kanban Workspace**: Manage task progress with native HTML5 drag-and-drop column sorting (`New`, `Assigned`, `In Progress`, `Review`, `Completed`). It includes status auditing logs.
4. **Scoping Access Control (RBAC)**: Custom workspaces for Clients (uploads & review), Editors (cut lists), VFX Artists (effects checklists), Production Managers (timeline owners), and Admins (settings).
5. **Interactive Project Chatbot**: Real-time project-aware chatbot assistant to answer questions about feedback and timelines.
6. **Analytical Reports Dashboard**: Export visual summaries of team productivity, revision history, and project checklist completions into raw downloadable CSV spreadsheets.

---

## Technical Stack

- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, Chart.js, React Router, Axios, Lucide Icons.
- **Backend**: Node.js, Express.js, JWT, bcryptjs, Multer.
- **Database**: MySQL (Production-ready) with an **Automatic SQLite fallback** for local zero-configuration execution.
- **Storage**: Cloudinary (Production-ready) with an **Automatic local folder fallback** for local disk hosting.

---

## Local Development Quickstart

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Step 1: Install Dependencies
Run the coordinated script in the root directory to install all dependencies for the workspace, backend, and frontend concurrently:
```bash
npm run install:all
```

### Step 2: Configure Environment Variables
Copy the template configuration in `backend/` and modify values:
```bash
cp backend/.env.example backend/.env
```

*Note: If MySQL, Cloudinary, or AI API keys are left blank, the app runs in **Mock Sandbox Mode** (using an auto-created SQLite file, local disk storage, and mock feedback analyzer engine) making it immediately runnable out of the box!*

### Step 3: Run the Application
Start both the backend server and frontend development server concurrently:
```bash
npm run dev
```

The app will start at:
- **Frontend URL**: `http://localhost:5173`
- **Backend URL**: `http://localhost:5000`

---

## Demo Developer Accounts (Seeded)
To test the role-based scopes, use these pre-seeded accounts:
- **Admin**: `admin@studio.com` / `admin123`
- **Production Manager**: `pm@studio.com` / `pm123`
- **Client**: `client@studio.com` / `client123`
- **Video Editor**: `editor@studio.com` / `editor123`
- **VFX Artist**: `vfx@studio.com` / `vfx123`

---

## Deployment Configuration Blueprint

### 1. Database Setup (Railway MySQL)
1. Provision a **MySQL Database** on Railway.
2. Retrieve the connection credentials.
3. Populate these in your production environment variables:
   `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.

### 2. Backend Hosting (Render)
1. Link your GitHub repository to Render and create a **Web Service**.
2. Set the build command to: `npm install --prefix backend`
3. Set the start command to: `npm start --prefix backend`
4. Declare environment variables in Render's dashboard:
   - `JWT_SECRET`: (Generate a secure key)
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
   - `GEMINI_API_KEY`: (Your Gemini key)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 3. Frontend Hosting (Vercel)
1. Create a project on Vercel and link your repository.
2. Select the **Root Directory** as `frontend/`.
3. Select **Vite** as the framework preset.
4. Declare Environment Variable:
   - `VITE_API_URL`: (Your production Render backend URL, e.g., `https://your-backend.onrender.com/api`)
5. Click Deploy. Vercel automatically handles building and serving the static bundle.
