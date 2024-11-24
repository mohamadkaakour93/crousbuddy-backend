const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Définit un répertoire cache pour Puppeteer.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),

  // Configure le téléchargement de Chrome.
  chrome: {
    skipDownload: false, // Force Puppeteer à télécharger Chrome.
  },
};
