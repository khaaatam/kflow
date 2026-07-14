const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');
const logger = require('./logger');

let model = null;

try {
    if (config.ai.apiKey) {
        const genAI = new GoogleGenerativeAI(config.ai.apiKey);
        model = genAI.getGenerativeModel({ model: config.ai.modelName });
        logger.info("AI Connected.");
    } else {
        logger.warn("API Key AI Kosong (Fitur AI nonaktif).");
    }
} catch (e) {
    logger.error("Gagal Init AI:", e.message);
}

// Kalau model null, kita kasih objek dummy biar gak crash pas dipanggil
module.exports = model || {
    generateContent: async () => ({ response: { text: () => "⚠️ Maaf, fitur AI lagi error/mati." } })
};