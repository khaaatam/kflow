const mysql = require('mysql2');
const config = require('../config');

// Kita pake Pool biar koneksi gak gampang putus (Auto Reconnect)
const pool = mysql.createPool(config.database);

// Kita export versi 'promise' biar bisa pake 'await db.query()' yang modern
module.exports = pool.promise();