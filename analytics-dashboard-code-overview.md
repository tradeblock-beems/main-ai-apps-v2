# Analytics Dashboard - Code Overview

## Server Management Commands

```bash
# Check if server is running
jobs
ps aux | grep "npm run start"

# View logs in real-time (in a new terminal)
tail -f /tmp/analytics-dashboard.log

# Stop the background server when needed
pkill -f "npm run start"

# Restart server in background
nohup npm run start > /tmp/analytics-dashboard.log 2>&1 &
```

## Project Structure

```
apps/analytics-dashboard/
├── app/                          # Next.js App Router
│   ├── api/analytics/new-users/  # API endpoints
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Homepage
├── src/
│   ├── types/analytics.ts       # TypeScript interfaces
│   ├── lib/
│   │   ├── config.ts           # Environment configuration
│   │   └── db.ts               # Database utilities
│   └── components/             # React components (Phase 5)
└── package.json                # Dependencies and scripts
```

## Key Technologies

- **Next.js 15.x**: App Router with TypeScript
- **D3.js 7.x**: Data visualization library
- **PostgreSQL**: Database with connection pooling
- **Tailwind CSS**: Styling with blue/slate theme
- **Port 3003**: Standalone operation

## Development Workflow

1. Start server: `nohup npm run start > /tmp/analytics-dashboard.log 2>&1 &`
2. Test API: `curl "http://localhost:3003/api/analytics/new-users/mock?days=7"`
3. View logs: `tail -f /tmp/analytics-dashboard.log`
4. Stop server: `pkill -f "npm run start"`
