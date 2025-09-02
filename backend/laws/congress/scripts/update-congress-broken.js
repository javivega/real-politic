const axios = require('axios');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const https = require('https');

// Download full XML files from Congress API by scraping the download page
async function downloadFullXML() {
  console.log('🚀 Starting download process...');
  
  try {
    console.log('🔍 Testing basic functionality...');
    
    const baseUrl = 'https://www.congreso.es';
    const downloadPageUrl = 'https://www.congreso.es/es/opendata/iniciativas';
    
    console.log(`📂 Base URL: ${baseUrl}`);
    console.log(`📂 Download page: ${downloadPageUrl}`);
    
    // Create date-based folder for this download session
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateFolder = `${day}${month}${year}`; // ddmmyyyy format
    const downloadDir = path.join(__dirname, 'downloads', dateFolder);
    
    console.log(`📂 Date folder: ${dateFolder}`);
    console.log(`📂 Download directory: ${downloadDir}`);
    
    // Ensure download directory exists
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
      console.log(`📁 Created download directory: ${downloadDir}`);
    } else {
      console.log(`📁 Download directory already exists: ${downloadDir}`);
    }

    console.log('📥 Starting targeted Congress XML download...\n');
    console.log(`📂 Files will be saved to: ${downloadDir}\n`);
    console.log('🎯 Only downloading files currently available on the webpage\n');
    console.log(`🔗 Accessing: ${downloadPageUrl}\n`);

    // Use only Puppeteer approach to get current files
    console.log('🔍 Scraping current webpage for available XML files...\n');
    const downloadUrls = await fetchUrlsWithEnhancedPuppeteer(downloadPageUrl);

    if (!downloadUrls || downloadUrls.length === 0) {
      console.log('❌ No download links found on the current webpage.');
      console.log('💡 The webpage might be temporarily unavailable or the structure has changed.');
      return;
    }

    console.log(`🎯 Found ${downloadUrls.length} download links on the current webpage:\n`);

    // Download each file using multiple methods
    for (const fileInfo of downloadUrls) {
      console.log(`\n📥 Processing: ${fileInfo.type}`);
      try {
        const success = await downloadWithMultipleMethods(fileInfo, downloadDir, downloadPageUrl);
        if (success) {
          console.log(`✅ Successfully downloaded: ${fileInfo.type}`);
        } else {
          console.log(`❌ Failed to download: ${fileInfo.type}`);
        }
      } catch (error) {
        console.error(`❌ Error downloading ${fileInfo.type}:`, error.message);
      }
      console.log('');
    }
    
    console.log('🎯 Download completed!');
    console.log(`📁 All files saved to: ${downloadDir}`);
    
  } catch (error) {
    console.error('❌ Error in download process:', error.message);
    console.log('💡 Check if the Congress website is accessible and try again.');
  }
}

// Try the known working URLs directly first
async function tryKnownWorkingUrls(baseUrl, downloadDir) {
  console.log('🔍 Trying known working URLs directly...\n');
  
  const knownUrls = [
    {
      url: `${baseUrl}/webpublica/opendata/iniciativas/IniciativasLegislativasAprobadas__20250814050018.xml`,
      type: 'iniciativas-legislativas-aprobadas'
    },
    {
      url: `${baseUrl}/webpublica/opendata/iniciativas/ProyectosDeLey__20250814050026.xml`,
      type: 'proyectos-de-ley'
    },
    {
      url: `${baseUrl}/webpublica/opendata/iniciativas/PropuestasDeReforma__20250814050035.xml`,
      type: 'propuestas-de-reforma'
    },
    {
      url: `${baseUrl}/webpublica/opendata/iniciativas/ProposicionesDeLey__20250814050137.xml`,
      type: 'proposiciones-de-ley'
    }
  ];

  const successfulDownloads = [];

  for (const fileInfo of knownUrls) {
    try {
      console.log(`📥 Trying known URL: ${fileInfo.type}`);
      
      const response = await axios.get(fileInfo.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/xml, text/xml, */*',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Referer': 'https://www.congreso.es/webpublica/opendata/iniciativas'
        }
      });

      if (response.status === 200 && response.data) {
        const xmlData = response.data;
        const filename = `congress-${fileInfo.type}-${Date.now()}.xml`;
        const filePath = path.join(downloadDir, filename);
        
        fs.writeFileSync(filePath, xmlData);
        
        console.log(`✅ Successfully downloaded: ${fileInfo.type}`);
        console.log(`   💾 Saved to: ${filePath}`);
        console.log(`   📊 Size: ${typeof xmlData === 'string' ? xmlData.length : 'N/A'} bytes`);
        
        // Verify it's valid XML
        if (typeof xmlData === 'string' && xmlData.trim().startsWith('<?xml')) {
          console.log(`   ✅ Valid XML format`);
        } else {
          console.log(`   ⚠️  Not standard XML format but saved`);
        }
        
        successfulDownloads.push(fileInfo);
      }
      
      // Add delay between downloads
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ Failed to download ${fileInfo.type}: ${error.message}`);
      
      // If known URL fails, try to discover a new one
      console.log(`   🔍 Attempting to discover new URL for ${fileInfo.type}...`);
      const newUrl = await discoverNewUrl(baseUrl, fileInfo.type);
      if (newUrl) {
        console.log(`   🎯 Found new URL: ${newUrl}`);
        try {
          const newResponse = await axios.get(newUrl, {
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/xml, text/xml, */*',
              'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
              'Referer': 'https://www.congreso.es/webpublica/opendata/iniciativas'
            }
          });

          if (newResponse.status === 200 && newResponse.data) {
            const xmlData = newResponse.data;
            const filename = `congress-${fileInfo.type}-${Date.now()}.xml`;
            const filePath = path.join(downloadDir, filename);
            
            fs.writeFileSync(filePath, xmlData);
            
            console.log(`✅ Successfully downloaded with new URL: ${fileInfo.type}`);
            console.log(`   💾 Saved to: ${filePath}`);
            console.log(`   📊 Size: ${typeof xmlData === 'string' ? xmlData.length : 'N/A'} bytes`);
            
            successfulDownloads.push({ ...fileInfo, url: newUrl });
          }
        } catch (newError) {
          console.log(`   ❌ New URL also failed: ${newError.message}`);
        }
      }
    }
    
    console.log('');
  }

  return successfulDownloads;
}

// Discover new URLs by trying different timestamp patterns
async function discoverNewUrl(baseUrl, type) {
  const typeMap = {
    'iniciativas-legislativas-aprobadas': 'IniciativasLegislativasAprobadas',
    'proyectos-de-ley': 'ProyectosDeLey',
    'propuestas-de-reforma': 'PropuestasDeReforma',
    'proposiciones-de-ley': 'ProposicionesDeLey'
  };

  const baseName = typeMap[type];
  if (!baseName) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // Try different timestamp patterns for today and recent days
  const timestampPatterns = [
    // Today with different times
    `${year}${month}${day}050000`, // 5 AM
    `${year}${month}${day}050100`, // 5:01 AM
    `${year}${month}${day}050200`, // 5:02 AM
    `${year}${month}${day}050300`, // 5:03 AM
    `${year}${month}${day}050400`, // 5:04 AM
    `${year}${month}${day}050500`, // 5:05 AM
    `${year}${month}${day}050600`, // 5:06 AM
    `${year}${month}${day}050700`, // 5:07 AM
    `${year}${month}${day}050800`, // 5:08 AM
    `${year}${month}${day}050900`, // 5:09 AM
    `${year}${month}${day}051000`, // 5:10 AM
    // Yesterday with similar times
    `${year}${month}${String(now.getDate() - 1).padStart(2, '0')}050000`,
    `${year}${month}${String(now.getDate() - 1).padStart(2, '0')}050100`,
    `${year}${month}${String(now.getDate() - 1).padStart(2, '0')}050200`,
    // Day before yesterday
    `${year}${month}${String(now.getDate() - 2).padStart(2, '0')}050000`,
    `${year}${month}${String(now.getDate() - 2).padStart(2, '0')}050100`,
  ];

  for (const timestamp of timestampPatterns) {
    const testUrl = `${baseUrl}/webpublica/opendata/iniciativas/${baseName}__${timestamp}.xml`;
    
    try {
      const response = await axios.head(testUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/xml, text/xml, */*'
        }
      });

      if (response.status === 200) {
        return testUrl;
      }
    } catch (error) {
      // Continue to next timestamp
      continue;
    }
  }

  return null;
}

// Fetch URLs using enhanced Puppeteer with tab navigation
async function fetchUrlsWithEnhancedPuppeteer(downloadPageUrl) {
  console.log('🔍 Navigating to download page with enhanced stealth...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the main page
    await page.goto(downloadPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Handle cookie consent
    await handleCookieConsent(page);
    
    // Wait for page to load completely
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Page loaded successfully');
    
    // Save debug HTML
    await saveDebugHTML(page);
    
    // Now extract download URLs from the current page content
    const downloadUrls = await extractDownloadUrls(page);
    
    return downloadUrls;
    
  } finally {
    await browser.close();
  }
}

async function handleCookieConsent(page) {
  try {
    // Wait a bit for cookie banner to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try the specific button the user provided
    const acceptButton = await page.$('a[title="Aceptar seleccionadas"]');
    if (acceptButton) {
      await acceptButton.click();
      console.log('🍪 Accepted cookies via "Aceptar seleccionadas" button');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    
    // Fallback: try by aria-label
    const acceptByAria = await page.$('a[aria-label="Aceptar solicitud de autorización"]');
    if (acceptByAria) {
      await acceptByAria.click();
      console.log('🍪 Accepted cookies via aria-label');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    
    // Fallback: try by onclick function
    const acceptByOnclick = await page.$('a[onclick*="acceptCookies"]');
    if (acceptByOnclick) {
      await acceptByOnclick.click();
      console.log('🍪 Accepted cookies via onclick function');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    
    console.log('⚠️  Could not handle cookie consent, continuing...');
  } catch (error) {
    console.log('⚠️  Error handling cookie consent:', error.message);
  }
}

// Extract download URLs using multiple methods
async function extractDownloadUrls(page) {
  const downloadUrls = [];
  
  try {
    // Method 1: Try your original XPath selectors first
    console.log('🔍 Trying original XPath selectors...');
    const xpathSelectors = [
      '/html/body/div[2]/div[1]/div[2]/section/div/div[2]/div[2]/div/div/section/div/div[2]/div/div/p[1]/a[3]',
      '/html/body/div[2]/div[1]/div[2]/section/div/div[2]/div[2]/div/div/section/div/div[2]/div/div/p[2]/a[3]',
      '/html/body/div[2]/div[1]/div[2]/section/div/div[2]/div[2]/div/div/section/div/div[2]/div/div/p[3]/a[3]',
      '/html/body/div[2]/div[1]/div[2]/section/div/div[2]/div[2]/div/div/section/div/div[2]/div/div/p[4]/a[3]'
    ];
    
    for (let i = 0; i < xpathSelectors.length; i++) {
      try {
        const elements = await page.$x(xpathSelectors[i]);
        if (elements && elements.length > 0) {
          const href = await page.evaluate(el => el.getAttribute('href'), elements[0]);
          if (href && href.includes('.xml')) {
            const absoluteUrl = new URL(href, 'https://www.congreso.es').href;
            const type = getFileTypeFromUrl(href);
            downloadUrls.push({ url: absoluteUrl, type });
            console.log(`🔗 Found via XPath (${type}): ${absoluteUrl}`);
          }
        }
      } catch (error) {
        console.log(`⚠️  XPath not found: ${xpathSelectors[i]}`);
      }
    }
    
    // Method 2: Scan for XML download buttons
    console.log('🔍 Scanning for XML download buttons...');
    const xmlButtons = await page.$$('a.btn.btn-primary.btn-vot[href*=".xml"]');
    console.log(`🔍 Found ${xmlButtons.length} XML download buttons`);
    
    for (const button of xmlButtons) {
      try {
        const href = await page.evaluate(el => el.getAttribute('href'), button);
        if (href && href.includes('.xml')) {
          const absoluteUrl = new URL(href, 'https://www.congreso.es').href;
          const type = getFileTypeFromUrl(href);
          
          // Check if we already have this URL
          if (!downloadUrls.some(du => du.url === absoluteUrl)) {
            downloadUrls.push({ url: absoluteUrl, type });
            console.log(`🔗 Found via button scan (${type}): ${absoluteUrl}`);
          }
        }
      } catch (error) {
        // Continue to next button
      }
    }
    
    // Method 3: Scan all XML links on page
    console.log('🔍 Scanning all XML links on page...');
    const allLinks = await page.$$('a[href*=".xml"]');
    
    for (const link of allLinks) {
      try {
        const href = await page.evaluate(el => el.getAttribute('href'), link);
        if (href && href.includes('.xml') && href.includes('opendata/iniciativas')) {
          const absoluteUrl = new URL(href, 'https://www.congreso.es').href;
          const type = getFileTypeFromUrl(href);
          
          // Check if we already have this URL
          if (!downloadUrls.some(du => du.url === absoluteUrl)) {
            downloadUrls.push({ url: absoluteUrl, type });
            console.log(`🔗 Found via general scan (${type}): ${absoluteUrl}`);
          }
        }
      } catch (error) {
        // Continue to next link
      }
    }
    
  } catch (error) {
    console.error('❌ Error extracting download URLs:', error.message);
  }
  
  return downloadUrls;
}

// Helper function to determine file type from URL
function getFileTypeFromUrl(url) {
  if (url.includes('IniciativasLegislativasAprobadas')) return 'iniciativas-legislativas-aprobadas';
  if (url.includes('ProyectosDeLey')) return 'proyectos-de-ley';
  if (url.includes('PropuestasDeReforma')) return 'propuestas-de-reforma';
  if (url.includes('ProposicionesDeLey')) return 'proposiciones-de-ley';
  return 'unknown';
}

async function saveDebugHTML(page) {
  try {
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const debugPath = path.join(debugDir, `opendata-page-${Date.now()}.html`);
    const htmlContent = await page.content();
    fs.writeFileSync(debugPath, htmlContent);
    console.log(`🧩 Saved page HTML for debugging: ${debugPath}`);
  } catch (error) {
    console.log(`⚠️  Could not save debug HTML: ${error.message}`);
  }
}

// Method 1: Download using Puppeteer (best for bypassing restrictions)
async function downloadWithPuppeteer(fileInfo, downloadDir) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Upgrade-Insecure-Requests': '1'
    });

    // Navigate to the download page first to establish session
    const downloadPageUrl = 'https://www.congreso.es/es/opendata/iniciativas';
    await page.goto(downloadPageUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Handle cookie consent
    await handleCookieConsent(page);
    
    // Wait for page to load completely
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all cookies from the page
    const cookies = await page.cookies();
    console.log(`   🍪 Got ${cookies.length} cookies from the page`);
    
    // Now try to access the XML file directly with the session cookies
    console.log(`   🔄 Accessing XML file: ${fileInfo.url}`);
    
    // Create a new page with the same cookies
    const downloadPage = await browser.newPage();
    await downloadPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set the cookies
    await downloadPage.setCookie(...cookies);
    
    // Set referer header to make it look like we came from the opendata page
    await downloadPage.setExtraHTTPHeaders({
      'Referer': downloadPageUrl,
      'Accept': 'application/xml, text/xml, */*',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    });
    
    // Navigate to the XML file
    const response = await downloadPage.goto(fileInfo.url, { waitUntil: 'networkidle2' });
    console.log(`   📡 Response status: ${response.status()}`);
    
    if (response.status() === 200) {
      const content = await downloadPage.content();
      
      // Check if it's XML content
      if (content.includes('<?xml') || (content.includes('<') && content.includes('>') && !content.includes('<!DOCTYPE html'))) {
        const filename = `congress-${fileInfo.type}-${Date.now()}.xml`;
        const filePath = path.join(downloadDir, filename);
        fs.writeFileSync(filePath, content);
        
        if (content.trim().startsWith('<?xml')) {
          console.log(`   ✅ Valid XML format downloaded`);
        } else {
          console.log(`   ⚠️  Content downloaded but not standard XML format`);
        }
        
        console.log(`   💾 Saved to: ${filePath}`);
        return true;
      } else {
        console.log(`   ❌ Page content is not XML (likely HTML error page)`);
        console.log(`   📄 Content preview: ${content.substring(0, 200)}...`);
        return false;
      }
    } else {
      console.log(`   ❌ HTTP error: ${response.status()}`);
      return false;
    }
    
  } finally {
    await browser.close();
  }
}

// Method 2: Enhanced Axios with session establishment
async function downloadWithEnhancedAxios(fileInfo, downloadDir, referer) {
  const axiosInstance = axios.create({
    timeout: 30000,
    maxRedirects: 5,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    })
  });

  // First, visit the referer page to establish session
  try {
    await axiosInstance.get(referer, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      }
    });
  } catch (e) {
    // Continue even if referer fails
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  const response = await axiosInstance.get(fileInfo.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/xml, text/xml, */*',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Referer': referer,
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1'
    }
  });

  if (response.status === 200 && response.data) {
    const xmlData = response.data;
    const filename = `congress-${fileInfo.type}-${Date.now()}.xml`;
    const filePath = path.join(downloadDir, filename);
    
    fs.writeFileSync(filePath, xmlData);
    
    console.log(`   ✅ Downloaded ${typeof xmlData === 'string' ? xmlData.length : 'N/A'} bytes`);
    
    if (typeof xmlData === 'string' && xmlData.trim().startsWith('<?xml')) {
      console.log(`   ✅ Valid XML format`);
    } else {
      console.log(`   ⚠️  Not standard XML format but saved`);
    }
    
    console.log(`   💾 Saved to: ${filePath}`);
    return true;
  }

  return false;
}

// Method 3: Session simulation with cookies
async function downloadWithSessionSimulation(fileInfo, downloadDir, referer) {
  // Create session with cookie jar simulation
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/xml, text/xml, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Referer': referer,
    'Connection': 'keep-alive',
    'Cookie': `sessionId=${Math.random().toString(36).substr(2, 9)}; acceptCookies=true`
  };

  const response = await axios.get(fileInfo.url, {
    timeout: 30000,
    headers
  });

  if (response.status === 200 && response.data) {
    const xmlData = response.data;
    const filename = `congress-${fileInfo.type}-${Date.now()}.xml`;
    const filePath = path.join(downloadDir, filename);
    
    fs.writeFileSync(filePath, xmlData);
    
    console.log(`   ✅ Downloaded ${typeof xmlData === 'string' ? xmlData.length : 'N/A'} bytes`);
    console.log(`   💾 Saved to: ${filePath}`);
    return true;
  }

  return false;
}

// Main download function using multiple methods
async function downloadWithMultipleMethods(fileInfo, downloadDir, referer) {
  console.log(`📥 Downloading: ${fileInfo.type}`);
  console.log(`🔗 URL: ${fileInfo.url}`);

  // Try Puppeteer first (most reliable)
  console.log('   🔄 Method 1: Puppeteer (recommended)');
  const puppeteerSuccess = await downloadWithPuppeteer(fileInfo, downloadDir);
  if (puppeteerSuccess) return true;

  // Try enhanced Axios
  console.log('   🔄 Method 2: Enhanced Axios');
  const axiosSuccess = await downloadWithEnhancedAxios(fileInfo, downloadDir, referer);
  if (axiosSuccess) return true;

  // Try session simulation
  console.log('   🔄 Method 3: Session simulation');
  const sessionSuccess = await downloadWithSessionSimulation(fileInfo, downloadDir, referer);
  if (sessionSuccess) return true;

  console.log('   ❌ All download methods failed');
  return false;
}

// Export the function for use in other modules
module.exports = {
    downloadFullXML,
    fetchUrlsWithEnhancedPuppeteer
};