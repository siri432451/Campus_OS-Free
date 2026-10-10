# CampusOS — Full-Stack Campus ICT Platform

> A production-grade student portal for Nigerian nursing colleges.  
> Stack: React + TypeScript + Vite · Node.js + Express · PostgreSQL + Prisma · Deployed on Ubuntu VPS

---

## Project Structure

```
campusos/
├── frontend/               React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── pages/          One file per screen (11 screens)
│   │   ├── components/     PhoneShell, BottomNav, shared UI
│   │   ├── context/        AuthContext (JWT state)
│   │   ├── api/            Axios client with JWT interceptor
│   │   └── App.tsx         Router + protected routes
│   └── dist/               Built output (deploy this)
│
├── backend/                Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/         One file per resource
│   │   ├── middleware/      JWT auth + role guards
│   │   ├── utils/          Prisma client singleton
│   │   └── index.ts        Express app entry
│   ├── prisma/
│   │   └── schema.prisma   Complete database schema
│   └── dist/               Compiled JS (run this)
│
├── nginx/campusos.conf     Nginx server block
├── ecosystem.config.js     PM2 process config
└── README.md               This file
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20 LTS
- PostgreSQL 15
- npm

### 1. Clone and install
```bash
git clone <your-repo> campusos
cd campusos
npm run install:all
```

### 2. Configure environment
```bash
# Backend
cp backend/.env.example backend/.env
nano backend/.env   # Edit DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Set up database
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE campusos_db;"
psql -U postgres -c "CREATE USER campusos_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE campusos_db TO campusos_user;"

# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed with demo data
npm run db:seed
```

### 4. Start development servers
```bash
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

### Default Login Credentials (after seed)
| Role | Login | Password |
|---|---|---|
| Super Admin | ADMIN001 | Admin123! |
| Lecturer | LEC001 | Lecturer123! |
| Student | NSG/2022/001 | Student123! |

---

## VPS Deployment (Ubuntu 22 LTS)

### Step 1 — Connect to VPS
```bash
ssh ubuntu@YOUR_VPS_IP
```

### Step 2 — Install dependencies (skip if already done for AIMEsays)
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# PM2
sudo npm install -g pm2

# Build tools
sudo apt install -y git build-essential
```

### Step 3 — Create database
```bash
sudo -u postgres psql
CREATE DATABASE campusos_db;
CREATE USER campusos_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE campusos_db TO campusos_user;
\q
```

### Step 4 — Deploy application
```bash
# Create directories
sudo mkdir -p /var/www/campusos
sudo mkdir -p /var/log/campusos
sudo mkdir -p /var/www/campusos/uploads/{books,print}
sudo chown -R ubuntu:ubuntu /var/www/campusos
sudo chown -R ubuntu:ubuntu /var/log/campusos

# Clone repo
cd /var/www/campusos
git clone <your-repo> .

# Install dependencies
npm run install:all

# Configure environment
cp backend/.env.example backend/.env
nano backend/.env
# Set: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, NODE_ENV=production, UPLOAD_DIR=/var/www/campusos/uploads

cp frontend/.env.example frontend/.env
nano frontend/.env
# Set: VITE_API_URL=https://YOUR_DOMAIN (or http://YOUR_VPS_IP)
```

### Step 5 — Build and migrate
```bash
# Build both apps
npm run build

# Run database migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed database
npm run db:seed
```

### Step 6 — Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the printed command to enable on reboot
```

### Step 7 — Configure Nginx
```bash
# Copy config
sudo cp nginx/campusos.conf /etc/nginx/sites-available/campusos

# Edit domain
sudo nano /etc/nginx/sites-available/campusos
# Replace YOUR_DOMAIN with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/campusos /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 8 — SSL Certificate (optional but recommended)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
# Certbot auto-edits nginx config and sets up renewal
```

---

## Coexisting with AIMEsays

Both apps run on the same VPS with different domains/subdomains:

| App | Domain | Port | PM2 Name |
|---|---|---|---|
| AIMEsays | aimesays.com | 4000 (example) | aimesays-api |
| CampusOS | campusos.yourdomain.com | 3001 | campusos-api |

Nginx routes each domain to the correct port. No conflicts.

---

## Completing the Frontend Pages

The page files in `frontend/src/pages/` are ready for you to fill in. For each screen:

1. Open `campusOS.jsx` (the design file)
2. Copy the corresponding component (e.g. `Library`)  
3. Replace `go('x')` → `navigate('/x')`
4. Replace dummy data with `api.get('/api/...')` calls
5. Add loading and error states

### API Reference

| Feature | Endpoint |
|---|---|
| Login | POST `/api/auth/login` |
| My profile | GET `/api/auth/me` |
| Books list | GET `/api/books` |
| Download book | GET `/api/books/:id/download` |
| My results | GET `/api/results/my` |
| Start attendance | POST `/api/attendance/sessions` |
| Submit attendance | POST `/api/attendance/scan` |
| Print balance | GET `/api/print/balance` |
| Submit print job | POST `/api/print/jobs` |
| Print history | GET `/api/print/my-history` |
| Announcements | GET `/api/announcements` |
| AI chat | POST `/api/ai/chat` |
| Flashcard decks | GET `/api/flashcards/decks` |
| Flashcard cards | GET `/api/flashcards/decks/:id/cards` |
| Simulation cases | GET `/api/simulation/cases` |
| Leaderboard | GET `/api/simulation/leaderboard` |
| Wi-Fi status | GET `/api/wifi/status` |
| Admin: create user | POST `/api/admin/users` |
| Admin: list users | GET `/api/admin/users` |
| Admin: stats | GET `/api/admin/stats` |
| Admin: top up credit | POST `/api/admin/print-credits/topup` |

---

## Monitoring

```bash
# View logs
pm2 logs campusos-api

# Monitor CPU/RAM
pm2 monit

# Restart app
pm2 restart campusos-api

# View all processes (AIMEsays + CampusOS)
pm2 list

# After code update
git pull
npm run build
pm2 restart campusos-api
```

---

## Environment Variables Reference

### Backend (`backend/.env`)
```env
DATABASE_URL="postgresql://campusos_user:password@localhost:5432/campusos_db"
JWT_SECRET="your-secret-here"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=production
FRONTEND_URL="https://your-domain.com"
UPLOAD_DIR="/var/www/campusos/uploads"
MAX_FILE_SIZE_MB=100
ANTHROPIC_API_KEY="sk-ant-..."
ADMIN_EMAIL="admin@yourschool.edu.ng"
ADMIN_PASSWORD="StrongPassword123!"
ADMIN_NAME="System Administrator"
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://your-domain.com
VITE_APP_NAME=CampusOS
```
