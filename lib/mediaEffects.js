const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const FONT_PATH = path.join(__dirname, '..', 'fonts', 'impact.ttf');
const FONT_ARIAL = path.join(__dirname, '..', 'fonts', 'arial.ttf');

function hasFont(name) {
    const fp = name === 'arial' ? FONT_ARIAL : FONT_PATH;
    return fs.existsSync(fp);
}

function getFontPath(name) {
    return name === 'arial' ? FONT_ARIAL : FONT_PATH;
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function applyEffects(inputBuffer, options = {}) {
    const img = await Jimp.read(inputBuffer);
    img.resize(512, 512);

    if (options.negate) img.invert();
    if (options.grayscale) img.greyscale();
    if (options.blur) img.blur(Math.min(Math.max(Number(options.blur), 1), 100));
    if (options.brightness) img.brightness((Number(options.brightness) || 1) - 1);
    if (options.contrast) img.contrast((Number(options.contrast) || 1) - 1);
    if (options.hue) img.color([{ apply: 'hue', params: [Number(options.hue) || 0] }]);
    if (options.saturation) img.color([{ apply: 'saturate', params: [((Number(options.saturation) || 1) - 1) * 100] }]);

    return img.getBufferAsync(Jimp.MIME_WEBP);
}

async function svgToBuffer(svgString, outputFormat = 'png') {
    return new Promise((resolve, reject) => {
        const tmpIn = path.join(__dirname, '..', 'temp', `_svg_in_${Date.now()}.svg`);
        const tmpOut = path.join(__dirname, '..', 'temp', `_svg_out_${Date.now()}.${outputFormat}`);
        fs.writeFileSync(tmpIn, svgString);
        ffmpeg(tmpIn)
            .outputOptions(['-y'])
            .toFormat(outputFormat)
            .save(tmpOut)
            .on('end', () => {
                const buf = fs.readFileSync(tmpOut);
                fs.unlinkSync(tmpIn);
                fs.unlinkSync(tmpOut);
                resolve(buf);
            })
            .on('error', reject);
    });
}

async function textToSticker(text, options = {}) {
    const fontSize = Number(options.fontSize) || 80;
    const bgColor = options.bgColor || '#8ACE00';
    const textColor = options.textColor || 'black';
    const width = Number(options.width) || 512;
    const height = Number(options.height) || 512;

    const maxCharsPerLine = Math.floor(width / (fontSize * 0.5));
    const lines = [];
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = (currentLine + ' ' + word).trim();
        }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (height - totalTextHeight) / 2 + fontSize * 0.8;

    const textElements = lines.map((line, i) => {
        const y = startY + i * lineHeight;
        return `<text x="50%" y="${y}" text-anchor="middle" font-family="Impact, Arial, sans-serif" font-size="${fontSize}" fill="${textColor}">${escapeXml(line)}</text>`;
    }).join('\n');

    const bgFill = bgColor === 'transparent' ? 'none' : bgColor;
    const svg = `<svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="${bgFill}"/>
        ${textElements}
    </svg>`;

    const pngBuf = await svgToBuffer(svg, 'png');
    const img = await Jimp.read(pngBuf);
    return img.getBufferAsync(Jimp.MIME_WEBP);
}

async function createQuoteCard(quoteText, authorName, options = {}) {
    const width = 512;
    const height = 512;
    const bgColor = options.bgColor || '#1a1a2e';
    const textColor = options.textColor || 'white';

    const maxChars = 40;
    const fontSize = 32;
    const words = quoteText.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > maxChars) {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = (currentLine + ' ' + word).trim();
        }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = fontSize * 1.4;
    const startY = height * 0.25;

    const textElements = lines.map((line, i) => {
        return `<text x="50%" y="${startY + i * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${textColor}" font-style="italic">"${escapeXml(line)}"</text>`;
    }).join('\n');

    const authorY = startY + lines.length * lineHeight + 60;
    const svg = `<svg width="${width}" height="${height}">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${bgColor};stop-opacity:0.8" />
            </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)"/>
        <line x1="50" y1="40" x2="50" y2="${height - 40}" stroke="#e94560" stroke-width="4"/>
        ${textElements}
        <text x="50%" y="${authorY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#e94560">— ${escapeXml(authorName)}</text>
    </svg>`;

    return svgToBuffer(svg, 'png');
}

module.exports = { applyEffects, textToSticker, createQuoteCard, escapeXml, hasFont, getFontPath, FONT_PATH, FONT_ARIAL, svgToBuffer };
