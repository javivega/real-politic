# Evidence Context Integration for AI Analysis

## Overview

The AI Analysis Service now automatically integrates external evidence from news, social media, and legal documents to provide richer, more informed analysis of legislative initiatives.

## What is Evidence Context?

Evidence context is additional information gathered from external sources that helps the AI understand the real-world context of legislative initiatives:

- **📰 News Articles**: Recent news coverage and analysis
- **🐦 Social Media**: Political party positions and public statements
- **📋 Legal Documents**: Official BOCG and DS documents

## How It Works

### 1. Automatic Loading
- Evidence context is automatically loaded from `/public/evidence-context.json` when the service initializes
- No manual configuration required
- Falls back gracefully if evidence is not available

### 2. Smart Matching
- Matches initiatives by `id` or `num_expediente`
- Automatically injects relevant evidence into AI prompts
- Provides fallback when no evidence is available

### 3. Enhanced AI Prompts
- All AI analysis methods now include evidence context
- Problem analysis, technical pros/cons, and enhanced titles benefit from external context
- AI can reference real-world evidence in its analysis

## Evidence Context Structure

```json
{
  "initiative_id": "NUMEXPEDIENTE",
  "news": [
    {
      "url": "https://example.com/news",
      "title": "News Title",
      "snippet": "News snippet text..."
    }
  ],
  "x": {
    "PSOE": [
      {
        "url": "https://x.com/PSOE/status/123",
        "source": "x.com",
        "type": "tweet"
      }
    ]
  },
  "legal": {
    "bocg": "https://www.congreso.es/bocg/...",
    "ds": "https://www.congreso.es/ds/..."
  }
}
```

## Usage in AIAnalysisService

### Automatic Integration
```typescript
// Evidence context is automatically included in all prompts
const analysis = await aiService.analyzeInitiative(initiative);
const technicalAnalysis = await aiService.generateTechnicalProsCons(initiative);
const enhancedTitle = await aiService.generateEnhancedTitle(initiative);
```

### Manual Control
```typescript
// Check if evidence is available
const hasEvidence = aiService.hasEvidenceContext(initiative);

// Get evidence context for debugging
const evidence = aiService.getEvidenceContextForInitiative(initiative);

// Refresh evidence context
await aiService.refreshEvidenceContext();

// Get statistics
const stats = aiService.getEvidenceContextStats();
```

## Benefits

### 1. More Informed Analysis
- AI can reference real-world events and statements
- Analysis includes current political context
- Technical analysis benefits from recent news and studies

### 2. Better Accuracy
- Evidence-based position analysis
- Real-time context from social media
- Official document references

### 3. Cost Optimization
- Evidence context is loaded once and reused
- No additional API calls for evidence gathering
- Server-side caching still works for AI responses

## Generating Evidence Context

### Backend Pipeline
The evidence context is generated using a three-step process:

1. **News Evidence**: `NewsEvidenceService` fetches news via Google News
2. **Social Media**: `XEvidenceService` collects X.com posts via Google search
3. **Legal Documents**: `LegalEvidenceService` extracts BOCG/DS URLs and snippets

### CLI Commands
```bash
# Generate evidence context for all initiatives
node scripts/build-evidence-context.js

# Copy to public directory for frontend access
cp output/evidence-context.json ../../public/
```

### Frontend Integration
- Evidence context is automatically loaded from `/evidence-context.json`
- No additional frontend code required
- Works seamlessly with existing AI analysis features

## Configuration

### Environment Variables
No additional environment variables are required. The service automatically:
- Loads evidence from the public directory
- Falls back gracefully if evidence is unavailable
- Logs evidence usage for debugging

### File Locations
- **Source**: `backend/laws/congress/output/evidence-context.json`
- **Frontend**: `public/evidence-context.json`
- **Test**: `backend/laws/congress/test-evidence-context.js`

## Monitoring and Debugging

### Console Logs
The service provides detailed logging:
```
✅ Loaded evidence context for 15 initiatives
🔍 Evidence context used for rich prompt: { initiative_id: "123", hasNews: true, hasSocial: true, hasLegal: false }
⚠️ No evidence context available for technical pros/cons prompt of initiative 456
```

### Statistics
```typescript
const stats = aiService.getEvidenceContextStats();
console.log(`Total initiatives: ${stats.totalInitiatives}`);
console.log(`With evidence: ${stats.withEvidence}`);
```

### Export for Debugging
```typescript
const evidenceData = aiService.exportEvidenceContext();
console.log('Evidence context:', evidenceData);
```

## Testing

### Run Test Script
```bash
cd backend/laws/congress
node test-evidence-context.js
```

### Expected Output
```
🧪 Testing Evidence Context Integration

1️⃣ Testing evidence context loading...
✅ Loaded evidence context for 2 initiatives

2️⃣ Testing evidence context stats...
   Total initiatives: 2
   With evidence: 2

3️⃣ Testing evidence context text generation...
✅ Evidence context text generated successfully

4️⃣ Testing evidence context lookup...
✅ Evidence found for initiative: test-1

5️⃣ Testing non-existent initiative...
✅ Correctly returned null for non-existent initiative

🎉 Evidence Context Integration Test Complete!
```

## Troubleshooting

### Common Issues

1. **Evidence not loading**
   - Check if `/public/evidence-context.json` exists
   - Verify file permissions and format
   - Check browser console for fetch errors

2. **No evidence in prompts**
   - Verify initiative ID matching
   - Check evidence context stats
   - Ensure evidence file is properly formatted

3. **Performance issues**
   - Evidence context is loaded once and cached
   - Large evidence files may impact initial load time
   - Consider splitting evidence by initiative type

### Debug Commands
```typescript
// Check evidence availability
console.log('Has evidence:', aiService.hasEvidenceContext(initiative));

// Get evidence details
const evidence = aiService.getEvidenceContextForInitiative(initiative);
console.log('Evidence:', evidence);

// Refresh evidence context
await aiService.refreshEvidenceContext();
```

## Future Enhancements

### Planned Features
- **Real-time Updates**: WebSocket integration for live evidence updates
- **Evidence Scoring**: Confidence scoring for evidence quality
- **Multi-language Support**: Evidence in multiple languages
- **Advanced Filtering**: Evidence filtering by date, source, and relevance

### Integration Opportunities
- **News APIs**: Direct integration with news services
- **Social Media APIs**: Official API access for social media
- **Legal Databases**: Integration with legal research databases
- **Academic Sources**: Academic paper and research integration

## Conclusion

The evidence context integration significantly enhances the AI analysis service by providing real-world context and evidence. This leads to more accurate, informed, and relevant analysis of legislative initiatives while maintaining the existing caching and cost optimization features.

The integration is designed to be:
- **Automatic**: No manual configuration required
- **Robust**: Graceful fallbacks when evidence is unavailable
- **Efficient**: Evidence is loaded once and reused
- **Debuggable**: Comprehensive logging and monitoring
- **Extensible**: Easy to add new evidence sources 