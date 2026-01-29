const model = require('../lib/ai');
const Memory = require('../models/Memory');
const ChatLog = require('../models/ChatLog');
const config = require('../config');

// --- OBSERVER ---
const observe = async (client, msg, namaPengirim) => {
    const text = msg.body;
    if (text.startsWith('!') || text.length < 5) return;
    const blacklist = ['bot', 'fitur', 'command', 'reset', 'menu'];
    if (blacklist.some(w => text.toLowerCase().includes(w))) return;

    const triggers = ['suka', 'benci', 'mau', 'pengen', 'sedih', 'senang', 'marah', 'lapar', 'sakit'];
    if (!triggers.some(w => text.toLowerCase().includes(w))) return;

    try {
        const history = await ChatLog.getHistory(5);
        const prompt = `
        Tugas: Ekstrak FAKTA PERSONAL USER (${namaPengirim}).
        Konteks: \n${history}\nInput: "${text}"
        Output Format: [[SAVEMEMORY: Fakta Singkat]] atau KOSONG.
        Abaikan hal teknis/bot.
        `;

        const result = await model.generateContent(prompt);
        const match = result.response.text().match(/\[\[SAVEMEMORY:\s*(.*?)\]\]/);

        if (match && match[1]) {
            const fakta = `[${namaPengirim}] ${match[1].trim()}`;
            const success = await Memory.add(fakta);
            if (success && config.system?.logNumber) {
                client.sendMessage(config.system.logNumber, `📝 Ingatan Baru: ${fakta}`);
            }
        }
    } catch (e) { }
};

// --- INTERACT ---
const interact = async (client, msg, args, senderId, namaPengirim) => {
    const command = args[0];
    const content = msg.body.replace(command, '').trim();

    if (command === '!setpersona') {
        await Memory.setPersona(content);
        return msg.reply("✅ Persona diupdate.");
    }

    if (command === '!ingat') {
        await Memory.add(`[${namaPengirim}] ${content}`);
        return msg.reply("✅ Ingatan disimpan.");
    }

    if (command === '!ai' || command === '!analisa') {
        await msg.react('👀');
        try {
            const persona = await Memory.getPersona();
            const memories = await Memory.getAll(15);
            const history = await ChatLog.getHistory(10);
            const memText = memories.map(m => `- ${m.fakta}`).join('\n');

            const finalPrompt = `
            [SYSTEM]: ${persona}
            [MEMORIES]:\n${memText}
            [CHAT HISTORY]:\n${history}
            [USER INPUT]: "${content || 'Jelasin ini'}"
            `;

            let payload = [finalPrompt];
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                if (media.mimetype.startsWith('image/')) {
                    payload.push({ inlineData: { data: media.data, mimeType: media.mimetype } });
                }
            }

            const result = await model.generateContent(payload);
            msg.reply(result.response.text().replace(/^(Bot|AI):/i, '').trim());
        } catch (e) {
            console.error(e);
            msg.reply("❌ AI Error.");
        }
    }
};

module.exports = { observe, interact };
module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai', desc: 'Chat AI' },
        { command: '!ingat', desc: 'Simpan memori' },
        { command: '!setpersona', desc: 'Set sifat bot' }
    ]
};