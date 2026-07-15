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
            "SELECT id, fakta, created_at FROM memori WHERE user = ? ORDER BY id DESC LIMIT ?",
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

    static async delete(id, user) {
        if (user) {
            return db.query("DELETE FROM memori WHERE id = ? AND user = ?", [id, user]);
        }
        return db.query("DELETE FROM memori WHERE id = ?", [id]);
    }

    static async deleteAll(user) {
        const [result] = await db.query("DELETE FROM memori WHERE user = ?", [user]);
        return result.affectedRows;
    }

    static async search(user, keyword) {
        const [rows] = await db.query(
            "SELECT id, fakta FROM memori WHERE user = ? AND fakta LIKE ? ORDER BY id DESC LIMIT 20",
            [user, `%${keyword}%`]
        );
        return rows;
    }

    static async getCount(user) {
        const query = user
            ? "SELECT COUNT(*) as total FROM memori WHERE user = ?"
            : "SELECT COUNT(*) as total FROM memori";
        const [rows] = await db.query(query, user ? [user] : []);
        return rows[0].total;
    }

    // Cleanup old memories (keep last maxPerUser per user)
    static async cleanup(maxPerUser = 500) {
        try {
            const [users] = await db.query("SELECT DISTINCT user FROM memori");
            let totalDeleted = 0;

            for (const { user } of users) {
                const [rows] = await db.query(
                    "SELECT id FROM memori WHERE user = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
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