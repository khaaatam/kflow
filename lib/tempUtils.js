const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../temp');

/**
 * Pastikan folder temp ada, bikin kalau belum.
 */
function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    return TEMP_DIR;
}

/**
 * Generate path file sementara di folder temp.
 * @param {string} prefix - prefix nama file (misal: 'stk_in')
 * @param {string} ext - ekstensi file (misal: 'jpg', 'mp4')
 * @returns {string} full path ke file
 */
function tempPath(prefix, ext) {
    ensureTempDir();
    return path.join(TEMP_DIR, `${prefix}_${Date.now()}.${ext}`);
}

/**
 * Hapus file secara safe (best-effort).
 * @param  {...string} paths - paths yang mau dihapus
 */
function cleanupFiles(...paths) {
    for (const p of paths) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
}

module.exports = { ensureTempDir, tempPath, cleanupFiles, TEMP_DIR };
