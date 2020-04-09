#!/usr/bin/env node
'use strict';
const getStdin = require('get-stdin');
const jsdom = require('jsdom');
const hasFastlaneMeta = require('./lib/has-fastlane-meta');

(async function() {
  process.exit(hasFastlaneMeta(await getStdin()) === null ? 1 : 0);
}());
