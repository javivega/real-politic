# Real Politic Backend

Backend API for Real Politic - Parliament Transparency App using Supabase

## Features

- Congress data processing pipeline
- XML parsing and analysis
- Legislative relationship mapping
- Supabase integration
- Automated daily updates via cron jobs

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Database Operations

```bash
# Generate TypeScript types from Supabase schema
npm run db:generate-types

# Start local Supabase
npm run db:start

# Stop local Supabase
npm run db:stop

# Reset local database
npm run db:reset

# Apply migrations
npm run db:migrate

# Seed database
npm run db:seed
```

## Cron Jobs

The backend includes automated daily processing of Congress data via cron jobs.

### Setup

1. **Install dependencies** (already included in package.json):
   ```bash
   npm install
   ```

2. **Environment variables** - Ensure your `.env` file includes:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   RUN_ON_STARTUP=false  # Set to true to run on startup for testing
   ```

### Usage

**Development mode:**
```bash
npm run cron:dev
```

**Production mode:**
```bash
npm run build
npm run cron:start
```

### Schedule

- **Congress Processing**: Daily at 01:00 AM (Europe/Madrid timezone)
- **Cron Expression**: `0 1 * * *`

### What It Does

The cron job automatically:
1. Downloads latest Congress XML files
2. Processes and analyzes legislative data
3. Updates relationships and timelines
4. Uploads processed data to Supabase
5. Maintains data freshness for the application

### Monitoring

The cron job provides detailed logging:
- Start/completion timestamps
- Success/error status
- Processing pipeline progress

### Deployment Options

**Option 1: Standalone Process**
```bash
# Run as a separate process
npm run cron:start
```

**Option 2: System Service (Linux)**
Create a systemd service file:
```ini
[Unit]
Description=Real Politic Cron Jobs
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/node cron.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Option 3: Docker**
```dockerfile
# Add to your Dockerfile
CMD ["npm", "run", "cron:start"]
```

**Option 4: Cloud Cron Services**
- **AWS EventBridge**: Schedule Lambda functions
- **Google Cloud Scheduler**: HTTP endpoints
- **Heroku Scheduler**: Add-on for dynos

### Troubleshooting

**Check if cron is running:**
```bash
ps aux | grep cron
```

**View logs:**
```bash
# If running as service
journalctl -u real-politic-cron -f

# If running standalone
npm run cron:start
```

**Test manually:**
```bash
# Set environment variable to run on startup
RUN_ON_STARTUP=true npm run cron:dev
```

## API Endpoints

- `GET /health` - Health check
- `GET /congress/initiatives` - List Congress initiatives
- `POST /congress/process` - Trigger manual processing

## Architecture

The backend uses a service-oriented architecture:
- **CongressProcessingService**: Main orchestration
- **XmlProcessingService**: XML parsing and extraction
- **RelationshipService**: Legislative relationship analysis
- **SupabaseService**: Database integration
- **CronService**: Automated scheduling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT 