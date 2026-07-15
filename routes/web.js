const express = require('express');
const router = express.Router();
const db = require('../lib/database');
const config = require('../config');
const logger = require('../lib/logger');

// Simple auth check - no session needed
const checkAuth = (req) => {
    const password = config.system.dashboardPassword;
    if (!password) return true; // No password = open access
    return req.query.password === password || req.headers['x-dashboard-password'] === password;
};

const requireAuth = (req, res, next) => {
    if (checkAuth(req)) return next();

    res.status(401).send(`<!DOCTYPE html>
<html><head><title>Login</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body class="bg-light d-flex align-items-center justify-content-center" style="min-height:100vh">
<div class="card shadow-sm p-4" style="max-width:400px;width:100%">
    <h5 class="text-center mb-3">🔒 Dashboard Login</h5>
    <form method="GET">
        <input type="hidden" name="redirect" value="${req.originalUrl}">
        <input type="password" name="password" class="form-control mb-2" placeholder="Password" autofocus required>
        <button type="submit" class="btn btn-primary w-100">Login</button>
    </form>
</div></body></html>`);
};

// ROUTE UTAMA (DASHBOARD) - read-only, auth on query
router.get('/', async (req, res) => {
    const password = config.system.dashboardPassword;
    if (password && !checkAuth(req)) {
        // Show login form instead of leaking password in redirect
        return res.status(401).send(`<!DOCTYPE html>
<html><head><title>Login</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body class="bg-light d-flex align-items-center justify-content-center" style="min-height:100vh">
<div class="card shadow-sm p-4" style="max-width:400px;width:100%">
    <h5 class="text-center mb-3">🔒 Dashboard Login</h5>
    <form method="GET">
        <input type="password" name="password" class="form-control mb-2" placeholder="Password" autofocus required>
        <button type="submit" class="btn btn-primary w-100">Login</button>
    </form>
</div></body></html>`);
    }

    try {
        const [events] = await db.query("SELECT * FROM events ORDER BY tanggal ASC");
        const [statsOrang] = await db.query(
            "SELECT sumber, SUM(nominal) as total FROM transaksi GROUP BY sumber"
        );
        const [statsJenis] = await db.query(
            "SELECT jenis, SUM(nominal) as total FROM transaksi GROUP BY jenis"
        );

        res.render('index', {
            data: events,
            statsOrang: statsOrang || [],
            statsJenis: statsJenis || [],
            title: 'K-Flow Dashboard',
            password: password || ''
        });
    } catch (e) {
        logger.error("Error Web Dashboard:", e);
        res.render('index', {
            data: [],
            statsOrang: [],
            statsJenis: [],
            error: "Gagal mengambil data dari database.",
            password: ''
        });
    }
});

// ROUTE TAMBAH - requires auth + validation
router.post('/add', requireAuth, async (req, res) => {
    const { nama_event, tanggal } = req.body;

    if (!nama_event || !tanggal) {
        return res.status(400).send("Nama event dan tanggal wajib diisi.");
    }
    if (typeof nama_event !== 'string' || nama_event.trim().length === 0) {
        return res.status(400).send("Nama event tidak valid.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return res.status(400).send("Format tanggal harus YYYY-MM-DD.");
    }

    try {
        await db.query("INSERT INTO events (nama_event, tanggal, dibuat_oleh) VALUES (?, ?, ?)",
            [nama_event.trim().slice(0, 255), tanggal, 'Web Dashboard']
        );
        res.redirect('/');
    } catch (e) {
        logger.error("Gagal simpan event:", e);
        res.status(500).send("Gagal menyimpan event.");
    }
});

// ROUTE UPDATE - requires auth + validation
router.post('/update', requireAuth, async (req, res) => {
    const { id, jenis, nominal, keterangan, sumber, tanggal } = req.body;

    if (!id || !jenis || !nominal || !keterangan) {
        return res.status(400).send("Semua field wajib diisi.");
    }
    if (!['pemasukan', 'pengeluaran'].includes(jenis)) {
        return res.status(400).send("Jenis harus 'pemasukan' atau 'pengeluaran'.");
    }
    if (isNaN(parseInt(nominal)) || parseInt(nominal) < 0) {
        return res.status(400).send("Nominal harus angka positif.");
    }

    try {
        await db.query(
            "UPDATE transaksi SET jenis=?, nominal=?, keterangan=?, sumber=?, tanggal=? WHERE id=?",
            [jenis, parseInt(nominal), keterangan.trim().slice(0, 255), sumber || 'WEB', tanggal, id]
        );
        res.redirect('/');
    } catch (e) {
        logger.error("Gagal update transaksi:", e);
        res.status(500).send("Gagal update data.");
    }
});

// ROUTE HAPUS EVENT - requires auth
router.get('/delete/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
        return res.status(400).send("ID tidak valid.");
    }
    try {
        await db.query("DELETE FROM events WHERE id = ?", [id]);
        res.redirect('/');
    } catch (e) {
        logger.error("Gagal hapus event:", e);
        res.status(500).send("Gagal menghapus event.");
    }
});

// ROUTE HAPUS TRANSAKSI - requires auth
router.get('/hapus/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
        return res.status(400).send("ID tidak valid.");
    }
    try {
        await db.query("DELETE FROM transaksi WHERE id = ?", [id]);
        res.redirect('/');
    } catch (e) {
        logger.error("Gagal hapus transaksi:", e);
        res.status(500).send("Gagal menghapus transaksi.");
    }
});

// HEALTH ENDPOINT
router.get('/health', async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
    } catch (e) {
        res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
    }
});

module.exports = router;
