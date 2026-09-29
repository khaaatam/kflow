const logger = require('./logger');
const { MessageMedia } = require('whatsapp-web.js');
const { DOWNLOAD_TIMEOUT_MS, DOWNLOAD_MAX_RETRIES, DOWNLOAD_RETRY_DELAY_MS } = require('./constants');
/* eslint-disable no-undef */

async function downloadMedia(msg) {
    if (!msg.hasMedia) return undefined;

    const page = msg.client.pupPage;

    // WA Web kadang lapor mimetype generik (application/octet-stream) untuk
    // media — tapi downloadAndMaybeDecrypt nge-validasi mimetype vs type dan
    // throw "Unexpected mimetype ...". Normalisasi dulu berdasarkan msg.type.
    // Download manager WA juga tidak kenal type 'ptt' (pakai 'audio').
    const MIMETYPE_BY_TYPE = {
        image: 'image/jpeg',
        video: 'video/mp4',
        audio: 'audio/ogg',
        ptt: 'audio/ogg',
        sticker: 'image/webp'
    };
    const WA_TYPE = { ptt: 'audio' };

    let mimetype = msg.mimetype;
    if (!mimetype || mimetype === 'application/octet-stream') {
        mimetype = MIMETYPE_BY_TYPE[msg.type] || mimetype;
        logger.debug(`DownloadMedia: mimetype ${msg.mimetype} dinormalisasi jadi ${mimetype} (type=${msg.type})`);
    }
    const dlType = WA_TYPE[msg.type] || msg.type;

    const mediaInfo = {
        directPath: msg._data.directPath,
        encFilehash: msg._data.encFilehash,
        filehash: msg._data.filehash,
        mediaKey: msg._data.mediaKey,
        mediaKeyTimestamp: msg._data.mediaKeyTimestamp,
        mimetype: mimetype,
        type: dlType,
        filename: msg.filename,
        filesize: msg._data?.size
    };

    if (!mediaInfo.directPath || !mediaInfo.mediaKey) {
        throw new Error('Media info missing: directPath=' + !!mediaInfo.directPath + ', mediaKey=' + !!mediaInfo.mediaKey);
    }

    let lastError = null;

    for (let attempt = 0; attempt <= DOWNLOAD_MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            logger.info(`DownloadMedia retry ${attempt}/${DOWNLOAD_MAX_RETRIES}`);
            await new Promise(r => setTimeout(r, DOWNLOAD_RETRY_DELAY_MS * attempt));
        }

        try {
            const result = await Promise.race([
                page.evaluate(async (info) => {
                    const log = [];

                    try {
                        const dm = window.require('WAWebDownloadManager').downloadManager;

                        const decryptedMedia = await dm.downloadAndMaybeDecrypt({
                            directPath: info.directPath,
                            encFilehash: info.encFilehash,
                            filehash: info.filehash,
                            mediaKey: info.mediaKey,
                            mediaKeyTimestamp: info.mediaKeyTimestamp,
                            type: info.type,
                            signal: (new AbortController).signal,
                            downloadQpl: {
                                addAnnotations: function() { return this; },
                                addPoint: function() { return this; }
                            }
                        });

                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(new Blob([decryptedMedia]));
                        });

                        log.push('download OK, size=' + base64.length);

                        return {
                            success: true,
                            data: base64,
                            mimetype: info.mimetype,
                            filename: info.filename,
                            filesize: info.filesize,
                            log: log.join(' | ')
                        };
                    } catch (e) {
                        log.push('error: ' + (e?.message || String(e)));
                        return { error: log.join(' | ') };
                    }
                }, mediaInfo),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Download timeout')), DOWNLOAD_TIMEOUT_MS)
                )
            ]);

            if (result?.error) {
                lastError = new Error('Media download failed: ' + result.error);
                logger.error('DownloadMedia debug: ' + result.error);
                continue;
            }

            if (!result?.success) return undefined;
            return new MessageMedia(result.mimetype || 'application/octet-stream', result.data, result.filename, result.filesize);
        } catch (e) {
            lastError = e;
            logger.error('DownloadMedia attempt ' + (attempt + 1) + ' failed: ' + e.message);
        }
    }

    throw lastError;
}

module.exports = downloadMedia;
