#!/usr/bin/env node

/**
 * Cron Job Script for Real Politic Backend (Production)
 * 
 * Runs the congress processing pipeline daily at 01:00 AM
 * 
 * Usage:
 *   npm run cron:start  # Production mode
 */

const cron = require('node-cron');
require('dotenv').config();

// Import the congress processing main function
const { main: congressMain } = require('./laws/congress/index.js');

/**
 * Main cron job function
 */
async function runCongressProcessing() {
    const timestamp = new Date().toISOString();
    console.log(`🕐 [${timestamp}] Starting scheduled Congress processing...`);
    
    try {
        // Run the congress processing pipeline
        await congressMain();
        
        const completionTimestamp = new Date().toISOString();
        console.log(`✅ [${completionTimestamp}] Congress processing completed successfully`);
        
    } catch (error) {
        const errorTimestamp = new Date().toISOString();
        console.error(`❌ [${errorTimestamp}] Error in scheduled Congress processing:`, error);
        
        // In production, you might want to send notifications here
        // await sendErrorNotification(error);
    }
}

/**
 * Initialize cron jobs
 */
function initializeCronJobs() {
    console.log('🚀 Initializing Real Politic Cron Jobs...');
    
    // Schedule Congress processing daily at 01:00 AM
    const congressJob = cron.schedule('0 1 * * *', runCongressProcessing, {
        scheduled: true,
        timezone: "Europe/Madrid" // Spanish timezone
    });
    
    console.log('📅 Congress processing scheduled for daily at 01:00 AM (Europe/Madrid)');
    
    // Optional: Run immediately on startup for testing
    if (process.env.RUN_ON_STARTUP === 'true') {
        console.log('🚀 Running Congress processing on startup...');
        runCongressProcessing();
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down cron jobs...');
        congressJob.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down cron jobs...');
        congressJob.stop();
        process.exit(0);
    });
    
    console.log('✅ Cron jobs initialized successfully');
    console.log('⏰ Waiting for scheduled execution...');
}

// Start cron jobs
initializeCronJobs();
