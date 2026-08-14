const config = require('../config');
const logger = require('./logger');
const { MessageMedia } = require('whatsapp-web.js');
const fetch = require('node-fetch');

const TTS_URL = `${config.ai.routerUrl}/models/tts`;
const TTS_API_KEY = config.ai.apiKey;

const VOICE_OPTIONS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

async function textToSpeech(text, voice) {
    if (!TTS_API_KEY) {
        logger.warn('TTS: No API key configured');
        return null;
    }

    const selectedVoice = voice || VOICE_OPTIONS[Math.floor(Math.random() * VOICE_OPTIONS.length)];

    try {
        const response = await fetch(TTS_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TTS_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: selectedVoice,
                response_format: 'mp3',
            }),
            timeout: 30000,
        });

        if (!response.ok) {
            const errText = await response.text();
            logger.error(`TTS Error (${response.status}): ${errText.slice(0, 200)}`);
            return null;
        }

        const buffer = await response.buffer();
        const base64 = buffer.toString('base64');
        return MessageMedia.fromFilePath({ data: base64, mimetype: 'audio/mpeg', filename: 'voice.mp3' });
    } catch (e) {
        logger.error('TTS Error:', e.message);
        return null;
    }
}

async function sendVoiceNote(client, chatId, text, quotedMessageId) {
    const media = await textToSpeech(text);
    if (!media) return false;

    try {
        await client.sendMessage(chatId, media, {
            sendAudioAsVoice: true,
            ...(quotedMessageId ? { quotedMessageId } : {}),
        });
        return true;
    } catch (e) {
        logger.error('Voice send error:', e.message);
        return false;
    }
}

module.exports = { textToSpeech, sendVoiceNote, VOICE_OPTIONS };
