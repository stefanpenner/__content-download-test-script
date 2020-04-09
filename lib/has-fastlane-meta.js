'use strict';
const jsdom = require('jsdom');

module.exports = function(body) {
  return new jsdom.JSDOM(
    body
  ).window.document.querySelector('meta[name=Fastlane]');
}

