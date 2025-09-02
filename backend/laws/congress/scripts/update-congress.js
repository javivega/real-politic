#!/usr/bin/env node

/**
 * Working Congress XML download script
 * Based on the successful simple test approach
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Download full XML files from Congress API
async function downloadFullXML() {
  console.log('🚀 Starting download process...');
  
  const baseUrl = 'https://www.congreso.es';
  const downloadPageUrl = 'https://www.congreso.es/es/opendata/iniciativas';

  // Create date-based folder for this download session
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateFolder = `${day}${month}${year}`; // ddmmyyyy format
  const downloadDir = path.join(__dirname, 'downloads', dateFolder);
  
  // Ensure download directory exists
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`📁 Created download directory: ${downloadDir}`);
  }

  console.log('📥 Starting targeted Congress XML download...\n');
  console.log(`📂 Files will be saved to: ${downloadDir}\n`);
  console.log('🎯 Only downloading files currently available on the webpage\n');
  console.log(`🔗 Accessing: ${downloadPageUrl}\n`);

  try {
    // Use Puppeteer to get current files
    console.log('🔍 Scraping current webpage for available XML files...\n');
    const downloadUrls = await fetchUrlsWithPuppeteer(downloadPageUrl);

    if (!downloadUrls || downloadUrls.length === 0) {
      console.log('❌ No download links found on the current webpage.');
      console.log('💡 The webpage might be temporarily unavailable or the structure has changed.');
      return;
    }

    console.log(`🎯 Found ${downloadUrls.length} download links on the current webpage:\n`);

    // Download each file
    for (const fileInfo of downloadUrls) {
      console.log(`\n📥 Processing: ${fileInfo.type}`);
      try {
        const success = await downloadWithPuppeteer(fileInfo, downloadDir);
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

// Fetch URLs using Puppeteer
async function fetchUrlsWithPuppeteer(downloadPageUrl) {
  console.log('🔍 Navigating to download page...');
  
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
    
    // Extract download URLs
    const downloadUrls = await extractDownloadUrls(page);
    
    return downloadUrls;
    
  } finally {
    await browser.close();
  }
}

// Handle cookie consent
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

// Extract download URLs
async function extractDownloadUrls(page) {
  const downloadUrls = [];
  
  try {
    // Find XML download links
    const xmlLinks = await page.$$('a[href*=".xml"]');
    console.log(`🔍 Found ${xmlLinks.length} XML links`);
    
    for (const link of xmlLinks) {
      try {
        const href = await page.evaluate(el => el.getAttribute('href'), link);
        if (href && href.includes('.xml') && href.includes('opendata/iniciativas')) {
          const absoluteUrl = new URL(href, 'https://www.congreso.es').href;
          const type = getFileTypeFromUrl(href);
          
          downloadUrls.push({ url: absoluteUrl, type });
          console.log(`🔗 Found XML link (${type}): ${absoluteUrl}`);
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

// Download using Puppeteer
async function downloadWithPuppeteer(fileInfo, downloadDir) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
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
        
        // Try to extract XML content from HTML viewer
        let xmlContent = null;
        
        // Method 1: Look for XML content within the HTML viewer
        if (content.includes('webkit-xml-viewer-source-xml')) {
          console.log(`   🔍 Found HTML viewer, extracting XML content...`);
          
          try {
            // Extract content from the webkit-xml-viewer-source-xml div
            xmlContent = await downloadPage.evaluate(() => {
              const xmlDiv = document.getElementById('webkit-xml-viewer-source-xml');
              if (xmlDiv) {
                return xmlDiv.innerHTML;
              }
              return null;
            });
            
            if (xmlContent) {
              console.log(`   ✅ Successfully extracted XML content from HTML viewer`);
              // Clean up the XML content
              xmlContent = xmlContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            }
          } catch (error) {
            console.log(`   ⚠️  Error extracting XML from viewer: ${error.message}`);
          }
        }
        
        // Method 2: If no XML content extracted, try to find XML tags in the page
        if (!xmlContent) {
          console.log(`   🔍 Looking for XML tags in page content...`);
          
          try {
            xmlContent = await downloadPage.evaluate(() => {
              // Look for XML-like content
              const body = document.body;
              const text = body.textContent || body.innerText || '';
              
              // Try to find XML structure
              const xmlMatch = text.match(/<[^>]+>[\s\S]*<\/[^>]+>/);
              if (xmlMatch) {
                return xmlMatch[0];
              }
              
              return null;
            });
            
            if (xmlContent) {
              console.log(`   ✅ Found XML content in page text`);
            }
          } catch (error) {
            console.log(`   ⚠️  Error extracting XML from page text: ${error.message}`);
          }
        }
        
        // Method 3: If still no XML content, use the raw page content
        if (!xmlContent) {
          console.log(`   ⚠️  Could not extract XML content, using raw page content`);
          xmlContent = content;
        }
        
        // Save the extracted content
        const filename = `congress-${fileInfo.type}-${Date.now()}.xml`;
        const filePath = path.join(downloadDir, filename);
        fs.writeFileSync(filePath, xmlContent);
        
        if (xmlContent.trim().startsWith('<?xml') || xmlContent.includes('<results') || xmlContent.includes('<TITULO_LEY>')) {
          console.log(`   ✅ Valid XML content extracted and saved`);
        } else {
          console.log(`   ⚠️  Content saved but may not be standard XML format`);
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

// Save debug HTML
async function saveDebugHTML(page) {
  try {
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const debugFile = path.join(debugDir, `opendata-page-${timestamp}.html`);
    
    const html = await page.content();
    fs.writeFileSync(debugFile, html);
    
    console.log(`🧩 Saved page HTML for debugging: ${debugFile}`);
  } catch (error) {
    console.log('⚠️  Could not save debug HTML:', error.message);
  }
}

// Export the function for use in other modules
module.exports = {
    downloadFullXML,
    fetchUrlsWithPuppeteer
};

// If this script is run directly (not imported), execute the download
if (require.main === module) {
downloadFullXML().catch(console.error); 
} 