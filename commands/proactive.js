const reactive = require('../lib/proactive');

module.exports = async (client, msg, args) => {
    const sub = args[1];

    if (sub === 'on' || sub === '1' || sub === 'enable') {
        reactive.start(client);
        await msg.reply('✅ Proactive messages *ON*.\nBot bakal nge-chat duluan secara random.');
    } else if (sub === 'off' || sub === '0' || sub === 'disable') {
        reactive.stop();
        await msg.reply('✅ Proactive messages *OFF*.\nBot gak bakal nge-chat duluan.');
    } else {
        const status = reactive.isActive() ? '🟢 ON' : '🔴 OFF';
        await msg.reply(
            `💬 *PROACTIVE MESSAGES*\n\nStatus: ${status}\n\n` +
            '• `!proactive on` — Aktifin\n' +
            '• `!proactive off` — Matiin'
        );
    }
};

module.exports.metadata = {
    category: 'SYSTEM',
    commands: [{ command: '!proactive', desc: 'Toggle proactive messages (bot nge-chat duluan)' }],
};
