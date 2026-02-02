const { join } = require('path');

/**
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  // Matikan download otomatis biar gak error di Termux
  skipDownload: true,
};
