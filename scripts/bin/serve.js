const { SITE_PATH, serveJekyllSite } = require('../helper');

module.exports = { execute: serveJekyllSite.bind(null, SITE_PATH) };
