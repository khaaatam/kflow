/**
 * Media context helper — cek apakah pesan punya media atau quoted media.
 * @param {Object} msg - WhatsApp message object
 * @returns {Promise<{isMedia: boolean, isQuotedMedia: boolean, targetMsg: Object|null}>}
 */
async function getMediaContext(msg) {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    let targetMsg = null;
    if (isMedia) {
        targetMsg = msg;
    } else if (isQuotedMedia) {
        targetMsg = await msg.getQuotedMessage();
    }

    return { isMedia, isQuotedMedia, targetMsg };
}

module.exports = { getMediaContext };
