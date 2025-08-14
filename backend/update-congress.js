// Runner script to execute the download script from laws/congress directory
const path = require('path');

// Change to the laws/congress directory and run the download script
process.chdir(path.join(__dirname, 'laws', 'congress'));

console.log('🚀 Starting download from laws/congress directory...\n');

// Execute the download script
require('./download-full-xml.js'); 