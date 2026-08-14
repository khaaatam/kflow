const logger = require('../lib/logger');
const react = require('../lib/react');
const { createQuoteCard } = require('../lib/mediaEffects');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args) => {
    let quoteText = '';
    let authorName = args.slice(1).join(' ').trim() || 'Anonymous';

    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        quoteText = quoted.body || '';
        authorName = quoted.pushName || quoted.author || 'Anonymous';
    }

    if (!quoteText) return msg.reply('Reply pesan pake caption `!quote` atau `!quote [nama]`');

    await react(msg, '💬');
    try {
        const pngBuffer = await createQuoteCard(quoteText, authorName);
        const media = new MessageMedia('image/png', pngBuffer.toString('base64'));
        await msg.reply(media, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'K-Flow Bot',
            stickerName: 'Quote',
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('Quote Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [
        { command: '!quote', desc: 'Buat quote card dari pesan', isPublic: true },
        { command: '!q', desc: 'Shortcut !quote', isPublic: true },
    ],
};
