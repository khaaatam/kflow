const OpenAI = require('openai');
const config = require('../config');
const logger = require('./logger');
const crypto = require('crypto');

let client = null;
let modelName = null;
let isHealthy = true;
let lastHealthCheck = 0;

const HEALTH_CHECK_INTERVAL_MS = 60000;

// ============================================================
// AI RESPONSE CACHE
// ============================================================
const AI_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const AI_CACHE_MAX_ENTRIES = 100;
const aiCache = new Map();

function getCacheKey(prompt) {
    // Hash prompt content for cache key
    let content = '';
    if (typeof prompt === 'string') {
        content = prompt;
    } else if (Array.isArray(prompt)) {
        content = prompt.map(m => {
            if (typeof m.content === 'string') return m.content;
            if (Array.isArray(m.content)) {
                return m.content.map(p => p.text || '').join('');
            }
            return '';
        }).join('|||');
    }
    return crypto.createHash('md5').update(content).digest('hex');
}

function getCached(key) {
    const entry = aiCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > AI_CACHE_TTL_MS) {
        aiCache.delete(key);
        return null;
    }
    return entry.text;
}

function setCache(key, text) {
    // Evict oldest if full
    if (aiCache.size >= AI_CACHE_MAX_ENTRIES) {
        const oldest = aiCache.keys().next().value;
        aiCache.delete(oldest);
    }
    aiCache.set(key, { text, ts: Date.now() });
}

// Cleanup expired entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of aiCache) {
        if (now - entry.ts > AI_CACHE_TTL_MS) {
            aiCache.delete(key);
        }
    }
}, 10 * 60 * 1000);

// ============================================================
// INIT
// ============================================================
try {
    if (config.ai.apiKey) {
        client = new OpenAI({
            apiKey: config.ai.apiKey,
            baseURL: config.ai.routerUrl
        });
        modelName = config.ai.modelName;
        logger.info(`AI Connected via 9router (${modelName}).`);
    } else {
        logger.warn('API Key AI Kosong (Fitur AI nonaktif).');
        isHealthy = false;
    }
} catch (e) {
    logger.error('Gagal Init AI:', e.message);
    isHealthy = false;
}

function buildMessages(prompt) {
    if (Array.isArray(prompt) && prompt.length > 0 && prompt[0].role) {
        return prompt.map(msg => {
            if (typeof msg.content === 'string') return msg;
            if (Array.isArray(msg.content)) {
                const parts = msg.content.map(part => {
                    if (part.type === 'text') return { type: 'text', text: part.text };
                    if (part.type === 'image_url') return part;
                    return part;
                });
                return { role: msg.role, content: parts };
            }
            return msg;
        });
    }

    if (Array.isArray(prompt)) {
        const parts = [];
        for (const part of prompt) {
            if (typeof part === 'string') {
                parts.push({ type: 'text', text: part });
            } else if (part.inlineData) {
                parts.push({
                    type: 'image_url',
                    image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
                });
            }
        }
        return [{ role: 'user', content: parts }];
    }
    return [{ role: 'user', content: prompt }];
}

const FALLBACK_RESPONSES = [
    '⚠️ Maaf, AI lagi error. Coba lagi sebentar ya.',
    '⚠️ 9Router lagi down. Fitur AI sementara gak bisa dipake.',
    '⚠️ Otak digital lagi istirahat. Coba beberapa menit lagi.',
    '⚠️ AI lagi gangguan. Kalau urgent, langsung tanya aja ke Tami.',
];

function getFallbackResponse() {
    return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

async function checkHealth() {
    const now = Date.now();
    if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) return isHealthy;

    lastHealthCheck = now;
    try {
        if (!client) { isHealthy = false; return false; }
        await client.models.list();
        isHealthy = true;
    } catch (e) {
        logger.warn(`AI health check failed: ${e.message}`);
        isHealthy = false;
    }
    return isHealthy;
}

async function generateContent(prompt) {
    // Check cache first (skip for image prompts)
    const hasImage = Array.isArray(prompt) && prompt.some(m =>
        Array.isArray(m.content) && m.content.some(p => p.type === 'image_url')
    );

    if (!hasImage) {
        const cacheKey = getCacheKey(prompt);
        const cached = getCached(cacheKey);
        if (cached) {
            logger.debug('AI cache hit');
            return { response: { text: () => cached }, cached: true };
        }
    }

    // Health check
    if (!isHealthy && (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS)) {
        return { response: { text: () => getFallbackResponse() }, fallback: true };
    }

    try {
        const messages = buildMessages(prompt);
        const result = await client.chat.completions.create({
            model: modelName,
            messages
        });
        const text = result.choices[0].message.content;
        isHealthy = true;

        // Cache the response
        if (!hasImage) {
            setCache(getCacheKey(prompt), text);
        }

        return { response: { text: () => text } };
    } catch (e) {
        logger.error(`AI Error: ${e.message}`);
        isHealthy = false;
        return { response: { text: () => getFallbackResponse() }, fallback: true };
    }
}

async function generateContentStrict(prompt) {
    const messages = buildMessages(prompt);
    const result = await client.chat.completions.create({
        model: modelName,
        messages
    });
    const text = result.choices[0].message.content;
    return { response: { text: () => text } };
}

module.exports = client ? { generateContent, generateContentStrict, checkHealth } : {
    generateContent: async () => ({ response: { text: () => '⚠️ Maaf, fitur AI lagi error/mati.' }, fallback: true }),
    generateContentStrict: async () => { throw new Error('AI not configured'); },
    checkHealth: async () => false
};
