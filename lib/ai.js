const OpenAI = require('openai');
const config = require('../config');
const logger = require('./logger');

let client = null;
let modelName = null;

try {
    if (config.ai.apiKey) {
        client = new OpenAI({
            apiKey: config.ai.apiKey,
            baseURL: config.ai.routerUrl
        });
        modelName = config.ai.modelName;
        logger.info(`AI Connected via 9router (${modelName}).`);
    } else {
        logger.warn("API Key AI Kosong (Fitur AI nonaktif).");
    }
} catch (e) {
    logger.error("Gagal Init AI:", e.message);
}

function buildMessages(prompt) {
    // New format: array of { role, content } objects
    if (Array.isArray(prompt) && prompt.length > 0 && prompt[0].role) {
        return prompt.map(msg => {
            if (typeof msg.content === 'string') {
                return msg;
            }
            // Handle array content (text + image)
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

    // Legacy format: string or array with inlineData
    if (Array.isArray(prompt)) {
        const parts = [];
        for (const part of prompt) {
            if (typeof part === 'string') {
                parts.push({ type: 'text', text: part });
            } else if (part.inlineData) {
                parts.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                    }
                });
            }
        }
        return [{ role: 'user', content: parts }];
    }
    return [{ role: 'user', content: prompt }];
}

async function generateContent(prompt) {
    const messages = buildMessages(prompt);
    const result = await client.chat.completions.create({
        model: modelName,
        messages
    });
    const text = result.choices[0].message.content;
    return { response: { text: () => text } };
}

module.exports = client ? { generateContent } : {
    generateContent: async () => ({ response: { text: () => "⚠️ Maaf, fitur AI lagi error/mati." } })
};
