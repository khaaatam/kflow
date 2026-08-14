/* global Buffer */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const FONT_PATH = path.join(__dirname, '..', 'fonts', 'impact.ttf');
const FONT_ARIAL = path.join(__dirname, '..', 'fonts', 'arial.ttf');

function hasFont(name) {
    const fp = name === 'arial' ? FONT_ARIAL : FONT_PATH;
    return fs.existsSync(fp);
}

function getFontPath(name) {
    return name === 'arial' ? FONT_ARIAL : FONT_PATH;
}

async function applyEffects(inputBuffer, options = {}) {
    let image = sharp(inputBuffer);

    // Resize to 512x512 for sticker
    image = image.resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

    // Effects
    if (options.negate) image = image.negate();
    if (options.grayscale) image = image.grayscale();
    if (options.blur) image = image.blur(Math.min(Math.max(Number(options.blur), 0.3), 1000));
    if (options.brightness) image = image.modulate({ brightness: Number(options.brightness) || 1 });
    if (options.saturation) image = image.modulate({ saturation: Number(options.saturation) || 1 });
    if (options.hue) image = image.modulate({ hue: Number(options.hue) || 0 });

    // Background color replacement
    if (options.bgColor) {
        const svgBg = `<svg width="512" height="512"><rect width="512" height="512" fill="${options.bgColor}"/></svg>`;
        const bgBuffer = Buffer.from(svgBg);
        image = image.composite([{ input: bgBuffer, blend: 'dest-over' }]);
    }

    // Text overlay
    if (options.text) {
        const fontSize = Number(options.textSize) || 48;
        const textColor = options.textColor || 'white';
        const position = options.textPosition || 'center';

        let y = '50%';
        let dy = '0';
        if (position === 'top') { y = '15%'; dy = '0'; }
        else if (position === 'bottom') { y = '85%'; dy = '0'; }

        const svgText = `<svg width="512" height="512">
            <style>
                text { font-family: Impact, sans-serif; font-size: ${fontSize}px; fill: ${textColor}; text-anchor: middle; paint-order: stroke; stroke: black; stroke-width: 3px; }
            </style>
            <text x="50%" y="${y}" dy="${dy}">${escapeXml(options.text)}</text>
        </svg>`;
        image = image.composite([{ input: Buffer.from(svgText) }]);
    }

    return image.webp({ quality: 80 }).toBuffer();
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function textToSticker(text, options = {}) {
    const fontSize = Number(options.fontSize) || 80;
    const bgColor = options.bgColor || '#8ACE00'; // Brat green
    const textColor = options.textColor || 'black';
    const width = Number(options.width) || 512;
    const height = Number(options.height) || 512;

    // Word wrap
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

    const svg = `<svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="${bgColor}"/>
        ${textElements}
    </svg>`;

    return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
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

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { applyEffects, textToSticker, createQuoteCard, escapeXml, hasFont, getFontPath, FONT_PATH, FONT_ARIAL };
