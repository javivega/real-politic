#!/usr/bin/env node

/**
 * Test script to verify evidence context integration in AIAnalysisService
 * 
 * This script tests:
 * 1. Loading evidence context from evidence-context.json
 * 2. Building evidence context text for prompts
 * 3. Evidence context matching and lookup
 */

const path = require('path');
const fs = require('fs-extra');

// Mock the browser environment for Node.js testing
global.fetch = require('node-fetch');
global.window = {};

// Import the AIAnalysisService (we'll need to adapt it for Node.js)
// For now, let's test the evidence context logic directly

class MockEvidenceContext {
  constructor() {
    this.evidenceContext = new Map();
  }

  /**
   * Loads evidence context from a JSON file
   */
  async loadEvidenceContext(filePath) {
    try {
      const data = await fs.readJson(filePath);
      this.evidenceContext.clear();
      data.forEach((item) => {
        this.evidenceContext.set(item.initiative_id, item);
      });
      console.log(`✅ Loaded evidence context for ${this.evidenceContext.size} initiatives`);
      return true;
    } catch (error) {
      console.error('❌ Error loading evidence context:', error);
      return false;
    }
  }

  /**
   * Gets evidence context for a specific initiative
   */
  getEvidenceContext(initiativeId) {
    return this.evidenceContext.get(initiativeId);
  }

  /**
   * Builds evidence context text for AI prompts
   */
  buildEvidenceContextText(initiativeId) {
    const evidence = this.getEvidenceContext(initiativeId);
    if (!evidence) return '';

    let contextText = '\n🔍 EVIDENCIA EXTERNA DISPONIBLE:\n\n';

    // Add news evidence
    if (evidence.news && evidence.news.length > 0) {
      contextText += '📰 NOTICIAS RECIENTES:\n';
      evidence.news.slice(0, 3).forEach((news, index) => {
        contextText += `${index + 1}. ${news.title}\n`;
        if (news.snippet) {
          contextText += `   ${news.snippet.substring(0, 150)}${news.snippet.length > 150 ? '...' : ''}\n`;
        }
        contextText += `   Fuente: ${news.url}\n\n`;
      });
    }

    // Add social media evidence
    if (evidence.x && Object.keys(evidence.x).length > 0) {
      contextText += '🐦 POSICIONES EN REDES SOCIALES:\n';
      Object.entries(evidence.x).forEach(([party, posts]) => {
        contextText += `• ${party}: ${posts.length} publicaciones encontradas\n`;
        posts.slice(0, 2).forEach(post => {
          contextText += `  - ${post.type}: ${post.url}\n`;
        });
      });
      contextText += '\n';
    }

    // Add legal document evidence
    if (evidence.legal) {
      contextText += '📋 DOCUMENTOS LEGALES OFICIALES:\n';
      if (evidence.legal.bocg) {
        contextText += `• BOCG (Boletín Oficial del Congreso): ${evidence.legal.bocg}\n`;
      }
      if (evidence.legal.ds) {
        contextText += `• DS (Diario de Sesiones): ${evidence.legal.ds}\n`;
      }
      contextText += '\n';
    }

    return contextText;
  }

  /**
   * Gets evidence context stats
   */
  getEvidenceContextStats() {
    const totalInitiatives = this.evidenceContext.size;
    const withEvidence = Array.from(this.evidenceContext.values()).filter(evidence => 
      (evidence.news && evidence.news.length > 0) || 
      (evidence.x && Object.keys(evidence.x).length > 0) || 
      (evidence.legal && (evidence.legal.bocg || evidence.legal.ds))
    ).length;
    
    return { totalInitiatives, withEvidence };
  }
}

async function testEvidenceContext() {
  console.log('🧪 Testing Evidence Context Integration\n');

  const mockService = new MockEvidenceContext();
  
  // Test 1: Load evidence context
  console.log('1️⃣ Testing evidence context loading...');
  const evidencePath = path.join(__dirname, '../../../public/evidence-context.json');
  const loaded = await mockService.loadEvidenceContext(evidencePath);
  
  if (!loaded) {
    console.log('❌ Failed to load evidence context, exiting test');
    return;
  }

  // Test 2: Check stats
  console.log('\n2️⃣ Testing evidence context stats...');
  const stats = mockService.getEvidenceContextStats();
  console.log(`   Total initiatives: ${stats.totalInitiatives}`);
  console.log(`   With evidence: ${stats.withEvidence}`);

  // Test 3: Test evidence context text generation
  console.log('\n3️⃣ Testing evidence context text generation...');
  
  const testInitiativeId = 'test-1';
  const evidenceText = mockService.buildEvidenceContextText(testInitiativeId);
  
  if (evidenceText) {
    console.log('✅ Evidence context text generated successfully');
    console.log('   Length:', evidenceText.length, 'characters');
    console.log('   Contains news:', evidenceText.includes('📰 NOTICIAS RECIENTES'));
    console.log('   Contains social:', evidenceText.includes('🐦 POSICIONES EN REDES SOCIALES'));
    console.log('   Contains legal:', evidenceText.includes('📋 DOCUMENTOS LEGALES OFICIALES'));
  } else {
    console.log('❌ Failed to generate evidence context text');
  }

  // Test 4: Test evidence context lookup
  console.log('\n4️⃣ Testing evidence context lookup...');
  
  const evidence = mockService.getEvidenceContext(testInitiativeId);
  if (evidence) {
    console.log('✅ Evidence found for initiative:', testInitiativeId);
    console.log('   News count:', evidence.news?.length || 0);
    console.log('   Social media parties:', evidence.x ? Object.keys(evidence.x).join(', ') : 'None');
    console.log('   Legal documents:', evidence.legal ? Object.keys(evidence.legal).join(', ') : 'None');
  } else {
    console.log('❌ No evidence found for initiative:', testInitiativeId);
  }

  // Test 5: Test non-existent initiative
  console.log('\n5️⃣ Testing non-existent initiative...');
  const nonExistentEvidence = mockService.getEvidenceContext('non-existent');
  if (!nonExistentEvidence) {
    console.log('✅ Correctly returned null for non-existent initiative');
  } else {
    console.log('❌ Unexpectedly found evidence for non-existent initiative');
  }

  console.log('\n🎉 Evidence Context Integration Test Complete!');
}

// Run the test
if (require.main === module) {
  testEvidenceContext().catch(console.error);
}

module.exports = { MockEvidenceContext, testEvidenceContext }; 