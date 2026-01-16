# Hop Farm Beach Booking System

Modern booking system built with Tanstack Start, shadcn/ui, and Docker.

**Features:**
- Clean calendar showing real availability
- Stripe payment integration
- Admin panel for managing dates and bookings
- Email confirmations
- Mobile-friendly design
- Deploy anywhere with Docker

## Quick Start

### 1. Clone and Configure

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

### 2. Get Stripe Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your test keys (for testing) or live keys (for production)
3. Add to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   ```

### 3. Deploy with Docker

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The app runs on port 3000 by default.

### 4. Access

- **Booking page:** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin

## Deployment Options

### Option 1: Railway (Recommended - Easiest)

1. Sign up at [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Railway auto-deploys on git push

### Option 2: Fly.io

```bash
# Install fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Create app
fly launch

# Set secrets
fly secrets set STRIPE_SECRET_KEY=sk_xxx
fly secrets set STRIPE_PUBLISHABLE_KEY=pk_xxx
fly secrets set ADMIN_PASSWORD=your_password

# Deploy
fly deploy
```

### Option 3: Any VPS (DigitalOcean, Hetzner, etc.)

```bash
# SSH into your server
ssh user@your-server

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone your repo
git clone https://github.com/yourname/hop-farm-booking.git
cd hop-farm-booking

# Configure
cp .env.example .env
nano .env

# Start
docker compose up -d
```

### Option 4: Coolify (Self-hosted PaaS)

1. Install Coolify on your VPS
2. Add this repo as a new application
3. Set environment variables
4. Deploy

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_URL` | Yes | Your full URL (e.g., https://book.hopfarmbeach.com) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `ADMIN_PASSWORD` | Yes | Password for admin panel |
| `SMTP_HOST` | No | SMTP server for emails |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `FROM_EMAIL` | No | From email address |
| `ADMIN_EMAIL` | No | Email for admin notifications |

### Settings (via Admin Panel)

- Nightly rate (SEK)
- Minimum nights
- Maximum guests
- Check-in time
- Check-out time

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Database

Uses SQLite stored in `./data/bookings.db`. The database is:
- Auto-created on first run
- Persisted via Docker volume
- Zero configuration needed

### Backup

```bash
# Copy database file
docker compose cp booking:/app/data/bookings.db ./backup.db
```

### Restore

```bash
# Stop container
docker compose down

# Replace database
docker compose cp ./backup.db booking:/app/data/bookings.db

# Start again
docker compose up -d
```

## SSL/HTTPS

For production, put a reverse proxy in front:

### Nginx + Let's Encrypt

```nginx
server {
    listen 80;
    server_name book.hopfarmbeach.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name book.hopfarmbeach.com;

    ssl_certificate /etc/letsencrypt/live/book.hopfarmbeach.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/book.hopfarmbeach.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy (Easier)

```
book.hopfarmbeach.com {
    reverse_proxy localhost:3000
}
```

Caddy auto-provisions SSL certificates.

## Troubleshooting

### "Stripe not configured"
- Make sure `STRIPE_SECRET_KEY` is set in `.env`
- Restart the container after changing env vars

### Emails not sending
- Check SMTP settings in `.env`
- Without SMTP config, emails are logged to console instead

### Database errors
- Check that `./data` directory exists and is writable
- Try removing and recreating the volume: `docker compose down -v && docker compose up -d`

## What This Replaces

Your broken WooCommerce booking system.

---

**Built for Hop Farm Beach by Claude**
