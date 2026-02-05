# Local Team Deployment Guide

## Overview
This guide covers deploying EvidenceChain for your local research team, including database setup, environment configuration, AI service integration, and file storage.

## Prerequisites

### System Requirements
- **Node.js**: v18+ ([Download](https://nodejs.org/))
- **MongoDB**: v6+ ([Download](https://www.mongodb.com/try/download/community))
- **npm**: v9+ (comes with Node.js)
- **Git**: Latest version
- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+)

### AI Service Accounts (Choose One)
- **OpenAI API** ([Get key](https://platform.openai.com/api-keys)) - Recommended for GPT-4
- **Anthropic API** ([Get key](https://console.anthropic.com/)) - Recommended for Claude 3.5

### Optional Services
- **Google Cloud Vision API** - For enhanced OCR ([Setup guide](https://cloud.google.com/vision/docs/setup))
- **AWS S3** - For file storage ([Create bucket](https://aws.amazon.com/s3/))

## Installation Steps

### 1. Clone Repository

```powershell
# Clone from GitHub
git clone https://github.com/your-org/evidencechain.git
cd evidencechain

# Or if you have a local copy
cd "c:\Users\TateErlinger\Documents\Apps in Dev"
```

### 2. Install Dependencies

```powershell
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install

# Return to root
cd ..
```

### 3. Setup MongoDB

#### Option A: Local MongoDB Installation

```powershell
# Start MongoDB service (Windows)
net start MongoDB

# Or manually start MongoDB
mongod --dbpath "C:\data\db"

# Verify MongoDB is running
mongo --eval "db.version()"
```

#### Option B: MongoDB Atlas (Cloud)

1. Create free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a new cluster (M0 free tier)
3. Add database user (Database Access → Add New User)
4. Whitelist your IP (Network Access → Add IP Address)
5. Get connection string from "Connect" button

```
Connection string format:
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/evidencechain?retryWrites=true&w=majority
```

### 4. Configure Environment Variables

#### Server Configuration (`server/.env`)

```bash
# Create server/.env file
cd server
cp .env.example .env

# Edit with your values
notepad .env
```

**Required Variables:**

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/evidencechain
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/evidencechain

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# AI Services (Choose one or both)
# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# OCR Services
# Google Vision (optional, falls back to Tesseract)
GOOGLE_VISION_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXX

# File Storage
# Local storage (default)
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800  # 50MB in bytes

# AWS S3 (optional)
# AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
# AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# AWS_S3_BUCKET=evidencechain-documents
# AWS_REGION=us-east-1

# Email (for notifications - optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

#### Client Configuration (`client/.env`)

```bash
cd ../client
cp .env.example .env
notepad .env
```

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Environment
VITE_ENV=development

# Feature Flags (optional)
VITE_ENABLE_MOCK_API=false
VITE_ENABLE_DEBUG=true
```

### 5. Initialize Database

```powershell
# From server directory
cd server
npm run init-db

# This will create:
# - Database indexes
# - Default admin user
# - Sample PICOTS templates
```

**Default Admin Credentials:**
- Email: `admin@evidencechain.local`
- Password: `ChangeMe123!`
- **⚠️ IMPORTANT:** Change this password immediately after first login

### 6. Setup File Uploads Directory

```powershell
# Create uploads directory (if not using S3)
mkdir server\uploads
mkdir server\uploads\documents
mkdir server\uploads\temp

# Set permissions (Linux/Mac)
chmod 755 server/uploads
```

### 7. Start Development Servers

#### Option A: Start Everything Together

```powershell
# From root directory
npm run dev

# This starts:
# - Frontend (http://localhost:5173)
# - Backend (http://localhost:3000)
# - Concurrent logs in one terminal
```

#### Option B: Start Separately

**Terminal 1 - Backend:**
```powershell
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd client
npm run dev
```

### 8. Verify Installation

1. **Frontend:** Open browser to http://localhost:5173
2. **Backend:** Check http://localhost:3000/api/health
3. **Database:** Verify MongoDB connection in server logs

```powershell
# Test API endpoint
curl http://localhost:3000/api/health
# Expected: {"status":"ok","database":"connected","version":"1.0.0"}
```

## Production Deployment

### Option 1: Single Server Deployment

#### Build for Production

```powershell
# Build frontend
cd client
npm run build
# Output: client/dist/

# Build backend
cd ../server
npm run build
# Output: server/dist/
```

#### Serve with PM2

```powershell
# Install PM2 globally
npm install -g pm2

# Start backend
cd server
pm2 start dist/index.js --name evidencechain-api

# Serve frontend with static file server
pm2 serve ../client/dist 3001 --spa --name evidencechain-frontend

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Configure Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/evidencechain
server {
    listen 80;
    server_name evidencechain.yourorg.local;

    # Frontend
    location / {
        root /path/to/evidencechain/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Increase timeouts for large uploads
        client_max_body_size 50M;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

```powershell
# Enable site
sudo ln -s /etc/nginx/sites-available/evidencechain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Docker Deployment

#### Create Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    container_name: evidencechain-db
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: evidencechain
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: evidencechain-api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/evidencechain
      - PORT=3000
    env_file:
      - ./server/.env.production
    volumes:
      - ./server/uploads:/app/uploads
      - ./server/logs:/app/logs
    ports:
      - "3000:3000"
    depends_on:
      - mongodb

  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: evidencechain-frontend
    restart: unless-stopped
    environment:
      - VITE_API_URL=http://backend:3000/api
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mongo-data:
```

#### Backend Dockerfile

```dockerfile
# server/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist
COPY .env.production .env

# Create uploads directory
RUN mkdir -p uploads/documents uploads/temp

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### Frontend Dockerfile

```dockerfile
# client/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Deploy with Docker Compose

```powershell
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Update after code changes
docker-compose build
docker-compose up -d
```

## Database Backup & Restore

### Backup MongoDB

```powershell
# Local backup
mongodump --db evidencechain --out ./backups/$(date +%Y%m%d)

# Automated daily backup (Windows Task Scheduler)
# Create backup.ps1:
$date = Get-Date -Format "yyyyMMdd"
mongodump --db evidencechain --out "C:\backups\$date"
# Keep last 30 days
Get-ChildItem "C:\backups" -Directory | Where-Object {$_.CreationTime -lt (Get-Date).AddDays(-30)} | Remove-Item -Recurse

# Schedule with Task Scheduler:
# - Trigger: Daily at 2 AM
# - Action: powershell.exe -File "C:\path\to\backup.ps1"
```

### Restore MongoDB

```powershell
# Restore from backup
mongorestore --db evidencechain ./backups/20240115/evidencechain

# Restore specific collection
mongorestore --db evidencechain --collection extractions ./backups/20240115/evidencechain/extractions.bson
```

## User Management

### Create Admin User

```powershell
# From server directory
npm run create-user -- --email admin@yourorg.com --password SecurePass123 --role admin
```

### Reset User Password

```powershell
npm run reset-password -- --email user@yourorg.com
# Generates temporary password
```

## Monitoring & Maintenance

### Health Checks

```powershell
# API health
curl http://localhost:3000/api/health

# Database status
mongo --eval "db.serverStatus()"

# Disk usage
df -h  # Linux/Mac
Get-PSDrive C | Select-Object Used,Free  # Windows
```

### Log Rotation

```powershell
# Install winston-daily-rotate-file (already in package.json)

# Logs automatically rotate at:
# - server/logs/app-YYYYMMDD.log (application logs)
# - server/logs/error-YYYYMMDD.log (errors only)
# - Keeps last 30 days
```

### Performance Monitoring

```powershell
# Install PM2 monitoring dashboard (optional)
pm2 install pm2-server-monit

# View metrics
pm2 monit

# Check resource usage
pm2 status
```

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to MongoDB"

```powershell
# Check MongoDB service
net start | findstr MongoDB  # Windows
sudo systemctl status mongod  # Linux

# Test connection
mongo --host localhost --port 27017
```

#### 2. "AI extraction not working"

```powershell
# Verify API key
echo $env:OPENAI_API_KEY  # Windows
echo $OPENAI_API_KEY  # Linux/Mac

# Test API key
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### 3. "File upload fails"

```powershell
# Check upload directory permissions
icacls server\uploads  # Windows
ls -la server/uploads  # Linux/Mac

# Verify MAX_FILE_SIZE in .env
# Increase if needed (value in bytes)
```

#### 4. "Frontend can't reach backend"

```powershell
# Check CORS configuration in server/index.ts
# Verify VITE_API_URL in client/.env matches backend URL

# Test backend directly
curl http://localhost:3000/api/health
```

### Enable Debug Logging

```env
# server/.env
LOG_LEVEL=debug

# client/.env
VITE_ENABLE_DEBUG=true
```

## Security Best Practices

1. **Change default passwords** immediately
2. **Use HTTPS** in production (setup SSL certificates)
3. **Restrict MongoDB access** (firewall rules, authentication)
4. **Rotate API keys** periodically
5. **Enable rate limiting** (see `server/middleware/rateLimiter.ts`)
6. **Regular backups** (automated daily)
7. **Update dependencies** regularly (`npm audit fix`)

## Getting Help

- **Documentation**: Check `README.md`, `API.md`, `DATABASE.md`
- **Logs**: Review `server/logs/error-*.log`
- **GitHub Issues**: Report bugs at your repository
- **Team Support**: Contact your admin at admin@yourorg.com

## Next Steps

1. **Configure PICOTS templates** for your research area
2. **Add team members** via user management
3. **Test extraction workflow** with sample documents
4. **Setup automated backups**
5. **Review security settings**

---

**Deployment Complete!** 🎉

Access EvidenceChain at: http://localhost:5173 (development) or your configured domain (production)
