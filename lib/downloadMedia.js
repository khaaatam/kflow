const logger = require('./logger');
const { MessageMedia } = require('whatsapp-web.js');
/* eslint-disable no-undef, preserve-caught-error */

async function downloadMedia(msg) {
    if (!msg.hasMedia) return undefined;

    const page = msg.client.pupPage;
    const msgId = msg.id._serialized;

    const storeDefined = await page.evaluate(() => !!(window.Store && window.Store.Msg));

    if (!storeDefined) {
        logger.warn('window.Store missing — re-injecting minimal Store...');
        try {
            await page.evaluate(() => {
                if (!window.Store) window.Store = {};
                const collections = window.require('WAWebCollections');
                Object.assign(window.Store, collections);
                window.Store.DownloadManager = window.require('WAWebDownloadManager').downloadManager;
                window.Store.Cmd = window.require('WAWebCmd').Cmd;
                window.Store.User = window.require('WAWebUserPrefsMeUser');
                window.Store.WidFactory = window.require('WAWebWidFactory');
            });
            const storeOk = await page.evaluate(() => !!(window.Store && window.Store.Msg && window.Store.DownloadManager));
            if (!storeOk) throw new Error('Store still undefined after re-inject');
            logger.info('Store re-injected successfully');
        } catch (e) {
            logger.error('Store re-inject failed: ' + e.message);
            throw new Error('WA Web Store unavailable — cannot download media');
        }
    }

    const result = await page.evaluate(async (id) => {
        const log = [];

        try {
            const rawMsg = (await window.Store.Msg.getMessagesById([id]))?.messages?.[0];

            if (!rawMsg) {
                log.push('Store.Msg.get returned null for id=' + id);
                return { error: log.join(' | ') };
            }

            if (!rawMsg.mediaData) {
                log.push('mediaData is null/undefined, type=' + (rawMsg.type || 'unknown'));
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

    if (result?.error) {
        logger.error('DownloadMedia debug: ' + result.error);
        throw new Error('Media download failed: ' + result.error);
    }

    if (!result?.success) return undefined;
    return new MessageMedia(result.mimetype, result.data, result.filename, result.filesize);
}

module.exports = downloadMedia;
