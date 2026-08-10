const logger = require('./logger');

const SLOW_SEND_THRESHOLD_MS = 5000;
const WATCHDOG_SEND_THRESHOLD_MS = 60000;

// Stats
let totalSends = 0;
let totalLatency = 0;
let lastLatency = null;
let pendingCount = 0;
let watchdogCount = 0;
let realPings = [];
const MAX_REAL_PINGS = 10;

// Pending sends map: messageId → { start, chat, ackReceived }
const pendingSends = new Map();

let restartCallback = null;

function wrapClient(client, onRestart) {
    restartCallback = onRestart;

    const origSend = client.sendMessage.bind(client);

    client.sendMessage = async function (...args) {
        const start = Date.now();
        pendingCount++;

        try {
            const result = await origSend(...args);

            const latency = Date.now() - start;
            totalSends++;
            totalLatency += latency;
            lastLatency = latency;

            if (result && result.id && result.id.id) {
                pendingSends.set(result.id.id, {
                    start,
                    chat: result.from || args[0],
                    ackReceived: false
                });
            }

            if (latency > SLOW_SEND_THRESHOLD_MS) {
                logger.warn(`[PERF] Slow send: ${latency}ms → ${args[0]} (size=${args[1]?.data?.length || 'text'})`);
            }

            if (latency > WATCHDOG_SEND_THRESHOLD_MS) {
                watchdogCount++;
                logger.error(`[WATCHDOG] Send took ${latency}ms! Watchdog hit #${watchdogCount}`);
                if (watchdogCount >= 3 && restartCallback) {
                    logger.error('[WATCHDOG] 3 slow sends in a row — triggering restart');
                    restartCallback();
                }
            } else {
                watchdogCount = 0;
            }

            return result;
        } catch (e) {
            const latency = Date.now() - start;
            logger.error(`[PERF] Send failed after ${latency}ms: ${e.message}`);
            throw e;
        } finally {
            pendingCount--;
        }
    };

    client.on('message_create', (msg) => {
        if (!msg.fromMe || !msg.id || !msg.id.id) return;

        const pending = pendingSends.get(msg.id.id);
        if (pending && !pending.ackReceived) {
            pending.ackReceived = true;
            const roundTrip = Date.now() - pending.start;
            realPings.push(roundTrip);
            if (realPings.length > MAX_REAL_PINGS) realPings.shift();
            pendingSends.delete(msg.id.id);
        }
    });
}

function getStats() {
    const avg = totalSends > 0 ? Math.round(totalLatency / totalSends) : 0;
    const avgRealPing = realPings.length > 0
        ? Math.round(realPings.reduce((a, b) => a + b, 0) / realPings.length)
        : 0;

    return {
        totalSends,
        avgLatency: avg,
        lastLatency,
        pendingCount,
        avgRealPing,
        lastRealPing: realPings.length > 0 ? realPings[realPings.length - 1] : null,
        watchdogHits: watchdogCount
    };
}

module.exports = { wrapClient, getStats };
