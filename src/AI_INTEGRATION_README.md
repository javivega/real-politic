# 🤖 AI Integration for Legislative Analysis

## 🚀 Overview

This project now uses **OpenAI GPT-3.5-turbo** to provide intelligent, specific analysis of Spanish legislative initiatives. The AI service provides much better understanding of legal text than traditional NLP.

## 💰 Cost Analysis

- **Model**: GPT-3.5-turbo
- **Cost**: $0.002 per 1K tokens
- **Per Initiative**: ~$0.001 (300 tokens average)
- **$10 Budget**: **10,000 initiatives** analyzed! 🎉

## 🔧 Setup Instructions

### 1. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key

### 2. Configure Environment
1. Create a `.env` file in the project root
2. Add your API key:
```bash
REACT_APP_OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Restart Development Server
```bash
npm start
```

## 🎯 How It Works

### Primary Method: AI Analysis
1. **AI Service**: Analyzes initiative text with GPT-3.5-turbo
2. **Structured Output**: Returns JSON with problem, solution, sector, opposition, experts
3. **High Quality**: Understands legal context and provides specific analysis

### Fallback Method: Enhanced NLP
1. **NLP Fallback**: If AI fails, uses improved compromise.js analysis
2. **Always Works**: Guaranteed to provide some analysis
3. **Lower Quality**: But still better than before

## 🔍 Example Output

### AI Analysis (High Quality)
```
PROBLEMA: Se necesita regular la publicidad y contratación en el sector comercial

SOLUCIÓN: Esta ley establece normas para regular la publicidad y contratación

SECTOR: Sector comercial y publicitario

OPOSICIÓN: La oposición dice que costará mucho dinero y afectará a las empresas del sector publicidad

EXPERTOS: Los expertos del sector publicidad dicen que se necesita tiempo y recursos para implementar esta ley correctamente
```

### NLP Fallback (Lower Quality)
```
PROBLEMA: Se necesita regular la publicidad y contratación en Madrid, afectando a 180 mil personas. 
SOLUCIÓN: Esta ley establece regulaciones para resolver el problema. 
OPOSICIÓN: La oposición dice que costará mucho dinero y afectará a las empresas. 
EXPERTOS: Se necesita tiempo y recursos para implementar esta ley correctamente.
```

## 🚨 Important Notes

### Security
- **Browser Usage**: Currently uses `dangerouslyAllowBrowser: true`
- **Production**: Should use backend API to protect API key
- **Rate Limiting**: OpenAI has rate limits (3 requests per minute for free tier)

### Error Handling
- **API Failures**: Gracefully falls back to NLP
- **Rate Limits**: Handles OpenAI rate limiting
- **Network Issues**: Continues working with fallback

## 🔧 Customization

### Modify AI Prompts
Edit `src/services/aiAnalysisService.ts`:
```typescript
private buildPrompt(objeto: string, partido?: string, resultado?: string): string {
  // Customize the prompt here
  return `Your custom prompt...`;
}
```

### Adjust Confidence Threshold
```typescript
if (aiResult && aiResult.confidence > 0.6) { // Change 0.6 to your preference
  // Use AI result
}
```

### Modify Fallback Logic
Edit `generateNLPFallback()` function in `InitiativeDetailScreen.tsx`

## 📊 Monitoring Usage

### Check API Key Status
The debug section shows:
- ✅ AI Service Available / ❌ Not Available
- Estimated cost per initiative
- Estimated initiatives with $10 budget

### Console Logs
- 🤖 AI Analysis successful: [result]
- 🔄 Falling back to NLP analysis
- ❌ OpenAI API error: [error]

## 🚀 Future Improvements

1. **Backend API**: Move OpenAI calls to backend for security
2. **Caching**: Cache AI results to reduce API calls
3. **Batch Processing**: Analyze multiple initiatives at once
4. **Quality Metrics**: Track AI vs NLP quality
5. **Cost Optimization**: Use cheaper models for simple cases

## 🆘 Troubleshooting

### API Key Not Working
1. Check `.env` file exists
2. Verify API key format: `sk-...`
3. Restart development server
4. Check browser console for errors

### Rate Limiting
1. Wait 1 minute between requests
2. Check OpenAI dashboard for usage
3. Consider upgrading to paid plan

### Fallback Not Working
1. Check console for NLP errors
2. Verify compromise.js packages installed
3. Check initiative text is not empty

## 🎉 Benefits

1. **🎯 Much More Specific**: AI understands legal context
2. **🧠 Intelligent Analysis**: Provides meaningful insights
3. **💰 Cost Effective**: $0.001 per initiative
4. **🔄 Reliable**: Always has fallback
5. **📈 Scalable**: Can handle thousands of initiatives

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify OpenAI API key is valid
3. Check network connectivity
4. Review this README for solutions 