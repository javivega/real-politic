# Real Politic Cron Jobs - Deployment Guide

This guide covers how to deploy and manage the automated daily processing of Congress data via cron jobs.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Setup
Create a `.env` file with your configuration:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cron Configuration
RUN_ON_STARTUP=false  # Set to true for testing
NODE_ENV=production
TZ=Europe/Madrid

# Optional: Logging
LOG_LEVEL=info
LOG_FILE=./logs/cron.log
```

### 3. Test the Setup
```bash
# Development mode
npm run cron:dev

# Production mode
npm run build
npm run cron:start
```

## 📋 Deployment Options

### Option 1: Standalone Process (Recommended for Development)

**Start the cron service:**
```bash
npm run cron:start
```

**Stop the service:**
```bash
pkill -f "cron:start"
```

**Check if running:**
```bash
ps aux | grep cron
```

### Option 2: System Service (Linux Production)

1. **Copy the service file:**
```bash
sudo cp systemd-service.example /etc/systemd/system/real-politic-cron.service
```

2. **Edit the service file:**
```bash
sudo nano /etc/systemd/system/real-politic-cron.service
```

3. **Update paths and user:**
```ini
User=your_username
WorkingDirectory=/path/to/your/backend
```

4. **Enable and start the service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable real-politic-cron
sudo systemctl start real-politic-cron
```

5. **Check status:**
```bash
sudo systemctl status real-politic-cron
sudo journalctl -u real-politic-cron -f
```

### Option 3: Docker Deployment

1. **Build the image:**
```bash
docker build -f Dockerfile.cron -t real-politic-cron .
```

2. **Run with docker-compose:**
```bash
docker-compose -f docker-compose.cron.yml up -d
```

3. **Check logs:**
```bash
docker-compose -f docker-compose.cron.yml logs -f real-politic-cron
```

4. **Stop the service:**
```bash
docker-compose -f docker-compose.cron.yml down
```

### Option 4: Cloud Cron Services

#### AWS EventBridge
```bash
# Create a rule that triggers every day at 01:00 AM UTC
aws events put-rule \
  --name "real-politic-congress-processing" \
  --schedule-expression "cron(0 1 * * ? *)" \
  --description "Daily Congress data processing"

# Create a target (Lambda function or ECS task)
aws events put-targets \
  --rule "real-politic-congress-processing" \
  --targets "Id"="1","Arn"="your-lambda-or-ecs-arn"
```

#### Google Cloud Scheduler
```bash
# Create a job that runs daily at 01:00 AM
gcloud scheduler jobs create http real-politic-congress \
  --schedule="0 1 * * *" \
  --uri="https://your-app.com/api/cron/trigger" \
  --http-method=POST \
  --time-zone="Europe/Madrid"
```

#### Heroku Scheduler
```bash
# Add the addon
heroku addons:create scheduler:standard

# Set the command in Heroku dashboard:
npm run cron:start
```

## 🔧 Configuration

### Cron Schedule
The default schedule is daily at 01:00 AM (Europe/Madrid timezone):
- **Cron Expression**: `0 1 * * *`
- **Timezone**: Europe/Madrid
- **Frequency**: Daily

### Customize Schedule
Edit `src/cron.ts` to change the schedule:

```typescript
// Run every 6 hours
cron.schedule('0 */6 * * *', runCongressProcessing, {
    scheduled: true,
    timezone: "Europe/Madrid"
});

// Run on weekdays only
cron.schedule('0 1 * * 1-5', runCongressProcessing, {
    scheduled: true,
    timezone: "Europe/Madrid"
});

// Run twice daily
cron.schedule('0 1,13 * * *', runCongressProcessing, {
    scheduled: true,
    timezone: "Europe/Madrid"
});
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `RUN_ON_STARTUP` | Run processing on startup | `false` |
| `TZ` | Timezone for cron jobs | `Europe/Madrid` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE` | Log file path | `./logs/cron.log` |

## 📊 Monitoring

### Health Checks
The cron service provides health check endpoints:

```typescript
// Get cron status
GET /api/cron/status

// Response:
{
  "status": "running",
  "timestamp": "2025-08-27T10:54:00.995Z",
  "nextRun": "01:00 AM daily (Europe/Madrid)",
  "lastRun": "2025-08-27T01:00:00.000Z"
}
```

### Logging
Logs are written to:
- **Console**: Real-time output
- **File**: `./logs/cron.log` (if configured)
- **System**: Journald (systemd) or Docker logs

### Metrics
Track these key metrics:
- **Execution time**: How long each run takes
- **Success rate**: Percentage of successful runs
- **Data processed**: Number of initiatives processed
- **Errors**: Any failures and their frequency

## 🚨 Troubleshooting

### Common Issues

1. **Cron not running**
   ```bash
   # Check if process is running
   ps aux | grep cron
   
   # Check systemd status
   sudo systemctl status real-politic-cron
   
   # Check Docker logs
   docker logs real-politic-cron
   ```

2. **Permission errors**
   ```bash
   # Check file permissions
   ls -la cron.js
   
   # Fix permissions
   chmod +x cron.js
   ```

3. **Timezone issues**
   ```bash
   # Check system timezone
   timedatectl
   
   # Set timezone
   sudo timedatectl set-timezone Europe/Madrid
   ```

4. **Memory issues**
   ```bash
   # Check memory usage
   free -h
   
   # Check Node.js memory
   node --max-old-space-size=4096 cron.js
   ```

### Debug Mode
Enable debug logging:
```bash
DEBUG=* npm run cron:dev
```

### Manual Execution
Test the processing manually:
```bash
# Run congress processing directly
node laws/congress/index.js

# Run with specific options
node laws/congress/index.js --stats --upload-supabase
```

## 🔒 Security

### Best Practices
1. **Run as non-root user**
2. **Use environment variables for secrets**
3. **Restrict file system access**
4. **Enable logging and monitoring**
5. **Regular security updates**

### Network Security
- **Firewall**: Only allow necessary ports
- **VPN**: Use VPN for secure connections
- **SSL**: Encrypt data in transit

## 📈 Scaling

### Horizontal Scaling
- Run multiple cron instances
- Use load balancers
- Implement distributed locking

### Vertical Scaling
- Increase memory allocation
- Use more powerful CPUs
- Optimize database queries

### Performance Tuning
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=8192" npm run cron:start

# Use PM2 for process management
pm2 start cron.js --name "real-politic-cron" --max-memory-restart 1G
```

## 🔄 Maintenance

### Regular Tasks
- **Log rotation**: Prevent log files from growing too large
- **Database cleanup**: Remove old data periodically
- **Performance monitoring**: Track execution times
- **Security updates**: Keep dependencies updated

### Backup Strategy
- **Database backups**: Regular Supabase backups
- **Configuration backups**: Version control for config files
- **Log backups**: Archive old logs

## 📞 Support

### Getting Help
1. Check the logs for error messages
2. Review this deployment guide
3. Check GitHub issues
4. Contact the development team

### Useful Commands
```bash
# View recent logs
tail -f logs/cron.log

# Check cron status
curl http://localhost:3000/api/cron/status

# Restart service
sudo systemctl restart real-politic-cron

# View system resources
htop
```

---

**Real Politic Cron Jobs** - Automated daily processing for parliamentary transparency data.
