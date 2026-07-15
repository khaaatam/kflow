require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.ROUTER_API_KEY || 'sk-placeholder',
    baseURL: process.env.ROUTER_URL || 'http://localhost:20128/v1'
});

const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gpt-4o-mini',
    'gpt-4o',
    'claude-3-5-sonnet-20241022',
    'deepseek-chat'
];

async function checkModels() {
    console.log('🔍 Checking models via 9router...\n');

    for (const model of modelsToTry) {
        try {
            await client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5
            });
            console.log(`✅ ${model} — ACTIVE`);
        } catch (error) {
            const msg = error.status
                ? `HTTP ${error.status}: ${error.message}`
                : error.message;
            console.log(`❌ ${model} — ${msg}`);
        }
    }
}

checkModels();
