const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Download full XML files from Congress API
async function downloadFullXML() {
  const baseUrl = 'https://www.congreso.es';
  const endpoints = [
    '/webpublica/opendata/iniciativas/IniciativasLegislativasAprobadas__20250812050019.xml',
    '/webpublica/opendata/iniciativas/ProyectosDeLey__20250812050028.xml',
    '/webpublica/opendata/iniciativas/PropuestasDeReforma__20250812050035.xml',
    '/webpublica/opendata/iniciativas/ProposicionesDeLey__20250812050122.xml'
  ];

  // Create date-based folder for this download session
  const now = new Date();
  const dateFolder = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const downloadDir = path.join(__dirname, 'downloads', dateFolder);
  
  // Ensure download directory exists
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`📁 Created download directory: ${downloadDir}`);
  }

  console.log('📥 Downloading full XML files from Spanish Congress API...\n');
  console.log(`📂 Files will be saved to: ${downloadDir}\n`);

  for (const endpoint of endpoints) {
    try {
      const fullUrl = baseUrl + endpoint;
      const filename = `congress-full-${endpoint.split('/').pop()}`;
      const filePath = path.join(downloadDir, filename);
      
      console.log(`🔍 Downloading: ${fullUrl}`);
      
      const response = await axios.get(fullUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'RealPolitic/1.0 (Parliament Transparency App)',
          'Accept': 'application/xml, text/xml, */*'
        }
      });

      if (response.status === 200) {
        const xmlData = response.data;
        console.log(`✅ Downloaded ${xmlData.length} bytes`);
        
        // Save full file to date-based folder
        fs.writeFileSync(filePath, xmlData);
        console.log(`💾 Saved to: ${filePath}`);
        
        // Verify it's valid XML
        if (xmlData.trim().startsWith('<?xml')) {
          console.log(`✅ Valid XML format`);
        } else {
          console.log(`⚠️  Not valid XML format`);
        }
        
      }
      
    } catch (error) {
      console.log(`❌ Failed to download ${endpoint}: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🎯 Download completed!');
  console.log(`📁 All files saved to: ${downloadDir}`);
}

// Run download
downloadFullXML().catch(console.error); 