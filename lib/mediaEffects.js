const { Jimp } = require('jimp');
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { tempPath } = require('./tempUtils');

const FONT_PATH = path.join(__dirname, '..', 'fonts', 'impact.ttf');
const FONT_ARIAL = path.join(__dirname, '..', 'fonts', 'arial.ttf');

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgToPng(svgString) {
    const resvg = new Resvg(svgString, { font: { loadSystemFonts: true } });
    const pngData = resvg.render();
    return pngData.asPng();
}

function rawToWebp(rawBuf, w, h) {
    const rawPath = tempPath('raw', 'raw');
    const outPath = tempPath('webp', 'webp');
    fs.writeFileSync(rawPath, rawBuf);
    try {
        execFileSync('ffmpeg', [
            '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba',
            '-s', `${w}x${h}`, '-r', '1', '-i', rawPath,
            '-vcodec', 'libwebp', '-lossless', '0', '-q:v', '80',
            outPath
        ], { stdio: 'pipe', timeout: 10000 });
        return fs.readFileSync(outPath);
    } finally {
        try { fs.unlinkSync(rawPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
    }
}

function imgToWebp(img) {
    return rawToWebp(img.bitmap.data, img.bitmap.width, img.bitmap.height);
}

function pngToWebp(pngBuf) {
    const img = Jimp.read(pngBuf);
    return imgToWebp(img);
}

async function applyEffects(inputBuffer, options = {}) {
    const img = await Jimp.read(inputBuffer);
    img.resize({ w: 512, h: 512 });
    if (options.negate) img.invert();
    if (options.grayscale) img.greyscale();
    if (options.blur) img.blur(Math.min(Math.max(Number(options.blur), 1), 100));
    if (options.brightness) img.brightness((Number(options.brightness) || 1) - 1);
    if (options.saturation) img.color([{ apply: 'saturate', params: [((Number(options.saturation) || 1) - 1) * 100] }]);
    return imgToWebp(img);
}

async function textToSticker(text, options = {}) {
    const fontSize = Number(options.fontSize) || 80;
    const bgColor = options.bgColor || '#8ACE00';
    const textColor = options.textColor || 'black';
    const w = Number(options.width) || 512;
    const h = Number(options.height) || 512;
    const maxChars = Math.floor(w / (fontSize * 0.5));
    const lines = [];
    const words = text.split(' ');
    let cur = '';
    for (const word of words) {
        if ((cur + ' ' + word).trim().length > maxChars) { if (cur) lines.push(cur); cur = word; }
        else { cur = (cur + ' ' + word).trim(); }
    }
    if (cur) lines.push(cur);

    const lineH = fontSize * 1.2;
    const totalH = lines.length * lineH;
    const startY = (h - totalH) / 2 + fontSize;

    const textElements = lines.map((line, i) => {
        const y = startY + i * lineH;
        return `<text x="${w/2}" y="${y}" text-anchor="middle" font-family="Impact, Arial, sans-serif" font-size="${fontSize}" fill="${textColor}">${escapeXml(line)}</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="${bgColor === 'transparent' ? 'none' : bgColor}"/>
        ${textElements}
    </svg>`;

    return pngToWebp(svgToPng(svg));
}

async function createQuoteCard(quoteText, authorName) {
    const w = 512, h = 512;
    const words = quoteText.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
        if ((cur + ' ' + word).trim().length > 30) { if (cur) lines.push(cur); cur = word; }
        else { cur = (cur + ' ' + word).trim(); }
    }
    if (cur) lines.push(cur);

    const textElements = lines.map((line, i) => {
        return `<text x="60" y="${130 + i * 45}" font-family="Arial, sans-serif" font-size="32" fill="white" font-style="italic">${escapeXml(line)}</text>`;
    }).join('');

    const authorY = 130 + lines.length * 45 + 60;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#1a1a2e"/>
        <line x1="50" y1="40" x2="50" y2="${h - 40}" stroke="#e94560" stroke-width="4"/>
        ${textElements}
        <text x="60" y="${authorY}" font-family="Arial, sans-serif" font-size="24" fill="#e94560">— ${escapeXml(authorName)}</text>
    </svg>`;

    return svgToPng(svg);
}

async function svgToSticker(svgString) {
    return pngToWebp(svgToPng(svgString));
}

module.exports = { applyEffects, textToSticker, createQuoteCard, escapeXml, FONT_PATH, FONT_ARIAL, imgToWebp, rawToWebp, svgToPng, svgToSticker, pngToWebp };
