const logger = require('./logger');
const { MessageMedia } = require('whatsapp-web.js');
/* eslint-disable no-undef */
/**
 * Custom media download — bypasses wwebjs broken msg.downloadMedia().
 * Each WA Web internal step is wrapped in try-catch for debugging.
 * NOTE: The evaluate callback runs inside the browser — window/AbortController are valid there.
 */
async function downloadMedia(msg) {
    if (!msg.hasMedia) return undefined;

    const page = msg.client.pupPage;
    const msgId = msg.id._serialized;

    const result = await page.evaluate(async (id) => {
        const log = [];

        try {
            const rawMsg = window.Store.Msg.get(id) ||
                (await window.Store.Msg.getMessagesById([id]))?.messages?.[0];

            if (!rawMsg) {
                log.push('Store.Msg.get returned null');
                return { error: log.join(' | ') };
            }

            if (!rawMsg.mediaData) {
                log.push('mediaData is null/undefined');
                return { error: log.join(' | ') };
            }

            if (rawMsg.mediaData.mediaStage === 'REUPLOADING') {
                log.push('mediaStage=REUPLOADING (media expired)');
                return { error: log.join(' | ') };
            }

            if (rawMsg.mediaData.mediaStage !== 'RESOLVED') {
                try {
                    await rawMsg.downloadMedia({
                        downloadEvenIfExpensive: true,
                        rmrReason: 1
                    });
                    log.push('downloadMedia OK, stage=' + rawMsg.mediaData.mediaStage);
                } catch (dlErr) {
                    log.push('downloadMedia failed: ' + (dlErr?.message || String(dlErr)));
                    if (rawMsg.mediaData.mediaStage?.includes('ERROR')) {
                        return { error: log.join(' | ') };
                    }
                }
            } else {
                log.push('mediaStage already RESOLVED');
            }

            if (rawMsg.mediaData.mediaStage?.includes('ERROR') ||
                rawMsg.mediaData.mediaStage === 'FETCHING') {
                log.push('mediaStage=' + rawMsg.mediaData.mediaStage + ' (cannot download)');
                return { error: log.join(' | ') };
            }

            try {
                const decryptedMedia = await window.Store.DownloadManager.downloadAndMaybeDecrypt({
                    directPath: rawMsg.directPath,
                    encFilehash: rawMsg.encFilehash,
                    filehash: rawMsg.filehash,
                    mediaKey: rawMsg.mediaKey,
                    mediaKeyTimestamp: rawMsg.mediaKeyTimestamp,
                    type: rawMsg.type,
                    signal: (new AbortController).signal,
                    downloadQpl: {
                        addAnnotations: function() { return this; },
                        addPoint: function() { return this; }
                    }
                });

                const data = await window.WWebJS.arrayBufferToBase64Async(decryptedMedia);

                log.push('downloadAndMaybeDecrypt OK, size=' + data.length);

                return {
                    success: true,
                    data,
                    mimetype: rawMsg.mimetype,
                    filename: rawMsg.filename,
                    filesize: rawMsg.size,
                    log: log.join(' | ')
                };
            } catch (decErr) {
                log.push('downloadAndMaybeDecrypt failed: ' + (decErr?.message || String(decErr)));
                return { error: log.join(' | ') };
            }

        } catch (e) {
            log.push('unexpected error: ' + (e?.message || String(e)));
            return { error: log.join(' | ') };
        }
    }, msgId);
    /* eslint-enable no-undef */

    if (result?.error) {
        logger.error('DownloadMedia debug: ' + result.error);
        throw new Error('Media download failed: ' + result.error);
    }

    if (!result?.success) return undefined;
    return new MessageMedia(result.mimetype, result.data, result.filename, result.filesize);
}

module.exports = downloadMedia;
