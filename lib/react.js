const logger = require('./logger');

/**
 * Safe reaction helper — wraps msg.react() with error handling.
 * Pattern: ⏳ during processing → ✅ when done (persist, not removed)
 * @param {import('whatsapp-web.js').Message} msg
 * @param {string} emoji
 */
async function react(msg, emoji) {
    try {
        await msg.react(emoji);
    } catch (e) {
        logger.debug(`React failed (${emoji}): ${e.message || e}`);
    }
}

module.exports = react;
