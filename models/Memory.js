const db = require('../lib/database');
const logger = require('../lib/logger');

class Memory {
    static async add(user, fakta) {
        const [rows] = await db.query(
            "SELECT id FROM memori WHERE user = ? AND fakta LIKE ?", 
            [user, `%${fakta}%`]
        );

        if (rows.length === 0) {
            return db.query("INSERT INTO memori (user, fakta) VALUES (?, ?)", [user, fakta]);
        }
        return false;
    }

    static async getAll(limit = 20) {
        const [rows] = await db.query("SELECT * FROM memori ORDER BY id DESC LIMIT ?", [limit]);
        return rows;
    }

    static async getByUser(user, limit = 10) {
        const [rows] = await db.query(
            "SELECT fakta FROM memori WHERE user = ? ORDER BY id DESC LIMIT ?", 
            [user, limit]
        );
        return rows;
    }

    static async getPersona() {
        const [rows] = await db.query("SELECT instruction FROM system_instruction WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
        return rows.length > 0 ? rows[0].instruction : "Kamu adalah asisten AI.";
    }

    static async setPersona(instruction) {
        await db.query("UPDATE system_instruction SET is_active = 0");
        return db.query("INSERT INTO system_instruction (instruction) VALUES (?)", [instruction]);
    }

    // Cleanup old memories (keep last 500 per user)
    static async cleanup(maxPerUser = 500) {
        try {
            const [users] = await db.query("SELECT DISTINCT user FROM memori");
            let totalDeleted = 0;

            for (const { user } of users) {
                const [rows] = await db.query(
                    "SELECT id FROM memori WHERE user = ? ORDER BY id DESC LIMIT ?, 10000",
                    [user, maxPerUser]
                );
                if (rows.length > 0) {
                    const ids = rows.map(r => r.id);
                    const [result] = await db.query("DELETE FROM memori WHERE id IN (?)", [ids]);
                    totalDeleted += result.affectedRows;
                }
            }

            if (totalDeleted > 0) {
                logger.info(`Memory cleanup: deleted ${totalDeleted} old entries`);
            }
        } catch (e) {
            logger.error("Memory cleanup failed:", e.message);
        }
    }
}

module.exports = Memory;