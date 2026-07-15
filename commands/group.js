const logger = require('../lib/logger');
const react = require('../lib/react');

// ============================================================
// HELPER: CEK ADMIN
// ============================================================
async function isAdmin(client, msg) {
    try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return false;

        const contact = await msg.getContact();
        const senderNumber = contact.id._serialized;
        return chat.participants.some(p => p.id._serialized === senderNumber && p.isAdmin);
    } catch {
        return false;
    }
}

// ============================================================
// HELPER: AMBIL MENTIONED CONTACTS
// ============================================================
function getMentionedIds(msg) {
    if (!msg.mentionedIds || msg.mentionedIds.length === 0) return [];
    return msg.mentionedIds.map(id => id._serialized || id);
}

// ============================================================
// !kick @mention — kick member dari group (admin only)
// ============================================================
async function handleKick(client, msg, _args) {
    if (!(await isAdmin(client, msg))) {
        return msg.reply('❌ Hanya admin yang bisa kick member.');
    }

    const mentionedIds = getMentionedIds(msg);
    if (mentionedIds.length === 0) {
        return msg.reply('Tag orang yang mau di-kick.\nContoh: `!kick @namanya`');
    }

    const chat = await msg.getChat();
    const targetId = mentionedIds[0];

    // Gak bisa kick diri sendiri
    if (targetId === msg.author) {
        return msg.reply('❌ Gak bisa kick diri sendiri.');
    }

    // Cek apakah target admin
    const targetParticipant = chat.participants.find(p => p.id._serialized === targetId);
    if (targetParticipant && targetParticipant.isAdmin) {
        return msg.reply('❌ Gak bisa kick admin lain.');
    }

    try {
        await chat.removeParticipants([targetId]);
        await react(msg, '✅');

        try {
            const contact = await client.getContactById(targetId);
            const displayName = contact.pushname || contact.name || targetId;
            return msg.reply(`👋 *${displayName}* telah di-kick dari group.`);
        } catch {
            return msg.reply(`👋 *${targetId}* telah di-kick dari group.`);
        }
    } catch (e) {
        logger.error('Kick Error:', e.message);
        return msg.reply('❌ Gagal kick. Pastikan bot adalah admin.');
    }
}

// ============================================================
// !mute <menit> — mute group (admin only)
// ============================================================
async function handleMute(client, msg, args) {
    if (!(await isAdmin(client, msg))) {
        return msg.reply('❌ Hanya admin yang bisa mute group.');
    }

    const menit = parseInt(args[1]);
    if (isNaN(menit) || menit < 1 || menit > 43200) {
        return msg.reply('Durasi: 1 - 43200 menit (30 hari).\nContoh: `!mute 60`');
    }

    try {
        const chat = await msg.getChat();
        // Set announcement mode — hanya admin yang bisa kirim pesan
        await chat.setMessagesAdmin(chat.id._serialized);

        await react(msg, '🔇');
        await msg.reply(`🔇 *Group di-mute* selama ${menit} menit.\nHanya admin yang bisa kirim pesan.`);

        // Auto-unmute setelah waktu habis
        setTimeout(async () => {
            try {
                const freshChat = await client.getChatById(msg.from);
                await freshChat.setMessagesNotAdmin(freshChat.id._serialized);
                await client.sendMessage(msg.from, '🔊 *Group di-unmute.* Semua anggota bisa kirim pesan lagi.');
            } catch (e) {
                logger.error('Auto-unmute failed:', e.message);
            }
        }, menit * 60 * 1000);

    } catch (e) {
        logger.error('Mute Error:', e.message);
        return msg.reply('❌ Gagal mute. Pastikan bot adalah admin.');
    }
}

// ============================================================
// !unmute — unmute group (admin only)
// ============================================================
async function handleUnmute(client, msg) {
    if (!(await isAdmin(client, msg))) {
        return msg.reply('❌ Hanya admin yang bisa unmute group.');
    }

    try {
        const chat = await msg.getChat();
        await chat.setMessagesNotAdmin(chat.id._serialized);

        await react(msg, '🔊');
        await msg.reply('🔊 *Group di-unmute.* Semua anggota bisa kirim pesan lagi.');
    } catch (e) {
        logger.error('Unmute Error:', e.message);
        return msg.reply('❌ Gagal unmute. Pastikan bot adalah admin.');
    }
}

// ============================================================
// !groupinfo — info group
// ============================================================
async function handleGroupInfo(client, msg) {
    try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return msg.reply('❌ Ini bukan group chat.');

        const admins = chat.participants.filter(p => p.isAdmin).length;
        const members = chat.participants.length - admins;

        let info = `👥 *GROUP INFO*\n`;
        info += `📛 Nama: ${chat.name}\n`;
        info += `👥 Anggota: ${chat.participants.length} (${admins} admin, ${members} member)\n`;
        info += `🔒 Anti-Edit: ${chat.groupMetadata?.restrict ? 'Ya' : 'Tidak'}\n`;
        info += `📢 Announce: ${chat.groupMetadata?.announce ? 'Ya (mute)' : 'Tidak'}`;

        return msg.reply(info);
    } catch (e) {
        logger.error('GroupInfo Error:', e.message);
        return msg.reply('❌ Gagal ambil info group.');
    }
}

// ============================================================
// COMMAND ROUTER
// ============================================================
module.exports = async (client, msg, args) => {
    const command = args[0].toLowerCase();

    if (command === '!kick') return handleKick(client, msg, args);
    if (command === '!mute') return handleMute(client, msg, args);
    if (command === '!unmute') return handleUnmute(client, msg);
    if (command === '!groupinfo') return handleGroupInfo(client, msg);

    return false;
};

module.exports.metadata = {
    category: 'GROUP',
    commands: [
        { command: '!kick', desc: 'Kick member (admin)' },
        { command: '!mute', desc: 'Mute group X menit (admin)' },
        { command: '!unmute', desc: 'Unmute group (admin)' },
        { command: '!groupinfo', desc: 'Info group', isPublic: true }
    ]
};
