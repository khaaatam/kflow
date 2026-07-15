const logger = require('./logger');
const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
/* eslint-disable no-undef, preserve-caught-error */

function findStoreJs() {
    const candidates = [];

    try {
        const pkgPath = require.resolve('whatsapp-web.js/package.json');
        const base = path.dirname(pkgPath);
        candidates.push(path.join(base, 'src', 'util', 'Injected', 'Store.js'));
        candidates.push(path.join(base, 'lib', 'util', 'Injected', 'Store.js'));
    } catch { /* ignore */ }

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

let _exposeStoreFn = null;

function getExposeStoreFn() {
    if (_exposeStoreFn !== null) return _exposeStoreFn;

    const storePath = findStoreJs();
    if (!storePath) {
        logger.warn('Store.js not found on disk');
        _exposeStoreFn = false;
        return false;
    }

    try {
        const raw = fs.readFileSync(storePath, 'utf8');
        const fnMatch = raw.match(/exports\.ExposeStore\s*=\s*\([\s\S]*?\)\s*=>\s*\{/);
        if (!fnMatch) {
            logger.warn('Could not parse ExposeStore from ' + storePath);
            _exposeStoreFn = false;
            return false;
        }
        const fnBodyStart = fnMatch.index + fnMatch[0].length;
        let braceCount = 1;
        let i = fnBodyStart;
        while (i < raw.length && braceCount > 0) {
            if (raw[i] === '{') braceCount++;
            if (raw[i] === '}') braceCount--;
            i++;
        }
        const fnBody = raw.slice(fnBodyStart, i - 1);
        _exposeStoreFn = fnBody;
        logger.info('Loaded Store.js from: ' + storePath);
        return _exposeStoreFn;
    } catch (e) {
        logger.warn('Failed to read Store.js: ' + e.message);
        _exposeStoreFn = false;
        return false;
    }
}

async function downloadMedia(msg) {
    if (!msg.hasMedia) return undefined;

    const page = msg.client.pupPage;
    const msgId = msg.id._serialized;

    const storeDefined = await page.evaluate(() => !!(window.Store && window.Store.Msg));

    if (!storeDefined) {
        logger.warn('window.Store missing — re-injecting...');
        const fnBody = getExposeStoreFn();
        if (fnBody) {
            try {
                await page.evaluate(fnBody);
                const storeOk = await page.evaluate(() => !!(window.Store && window.Store.Msg));
                if (!storeOk) throw new Error('Store still undefined after re-inject');
                logger.info('Store re-injected successfully');
            } catch (e) {
                logger.error('Store re-inject failed: ' + e.message);
                throw new Error('WA Web Store unavailable — cannot download media');
            }
        } else {
            throw new Error('WA Web Store unavailable — Store.js not found');
        }
    }

    const result = await page.evaluate(async (id) => {
        const log = [];

        try {
            const rawMsg = window.Store.Msg.get(id) ||
                (await window.Store.Msg.getMessagesById([id]))?.messages?.[0];

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
