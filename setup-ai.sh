#!/bin/bash

echo "🤖 AI Integration Setup for Legislative Analysis"
echo "================================================"
echo ""

# Check if .env file exists
if [ -f ".env" ]; then
    echo "✅ .env file already exists"
else
    echo "📝 Creating .env file..."
    echo "# OpenAI Configuration" > .env
    echo "# Get your API key from: https://platform.openai.com/api-keys" >> .env
    echo "REACT_APP_OPENAI_API_KEY=your_openai_api_key_here" >> .env
    echo "" >> .env
    echo "# Supabase Configuration (if needed)" >> .env
    echo "REACT_APP_SUPABASE_URL=your_supabase_url_here" >> .env
    echo "REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here" >> .env
    echo "✅ .env file created"
fi

echo ""
echo "🔧 Next Steps:"
echo "1. Get your OpenAI API key from: https://platform.openai.com/api-keys"
echo "2. Edit .env file and replace 'your_openai_api_key_here' with your actual key"
echo "3. Restart your development server: npm start"
echo ""
echo "💰 Cost Information:"
echo "- Cost per initiative: ~$0.001"
echo "- With $10 budget: ~10,000 initiatives"
echo ""
echo "📚 For more information, see: src/AI_INTEGRATION_README.md"
echo ""
echo "🎉 Setup complete! Follow the steps above to activate AI analysis." 