const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

router.get('/', (req, res) => {
    res.render('index');
});

router.post('/add', async (req, res) => {
    const { jenis, nominal, keterangan } = req.body;

    if (!jenis || !nominal) return res.status(400).send("Data tidak lengkap!");
    if (isNaN(nominal) || nominal < 0) return res.status(400).send("Nominal tidak valid!");

    const cleanKet = keterangan ? keterangan.substring(0, 255) : '-';

    try {
        await Transaction.add('WEB_USER', jenis, nominal, cleanKet, 'Web Dashboard');
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send("Database Error");
    }
});

module.exports = router;