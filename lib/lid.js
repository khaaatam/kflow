const config = require('../config');
const logger = require('./logger');

const lidCache = new Map();

async function warmUpLids(client) {
    try {
        const ids = new Set();

        for (const id of Object.keys(config.users)) {
            ids.add(id);
        }

        for (const num of config.ownerNumber) {
            ids.add(num.includes('@') ? num : `${num}@c.us`);
        }

        if (config.system.logNumber) {
            ids.add(config.system.logNumber);
        }

        if (ids.size === 0) return;

        const results = await client.getContactLidAndPhone([...ids]);

        let count = 0;
        for (const { lid, pn } of results) {
            if (lid && pn) {
                const phoneBase = pn.replace(/@.*/, '');
                lidCache.set(`${phoneBase}@c.us`, lid);
                lidCache.set(phoneBase, lid);
                count++;
            }
        }

        logger.info(`[LID] Warmed up ${count} contacts`);
    } catch (e) {
        logger.warn(`[LID] Warm-up failed: ${e.message}`);
    }
}

function resolveId(id) {
    if (!id) return id;
    if (id.endsWith('@lid')) return id;

    const base = id.replace(/@.*/, '');
    return lidCache.get(`${base}@c.us`) || lidCache.get(base) || id;
}

module.exports = { warmUpLids, resolveId };
