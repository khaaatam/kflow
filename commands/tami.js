module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    if (text.toLowerCase().includes('tami')) msg.reply('Apa manggil-manggil Tami? 👀');
    if (text.toLowerCase().includes('sayang')) msg.reply('Iya sayang? 😘');
};
module.exports.metadata = { category: "LAINNYA", commands: [{ command: '!tami', desc: 'Panggil Tami' }] };