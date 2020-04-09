'use strict';

require('capture-exit').captureExit();
const workerpool = require('workerpool');
require('capture-exit').onExit(onExit);
let children = [];
function onExit() {
  children.forEach(child => child.kill());
}
const { execFile } = require('child_process');

module.exports = function(args) {
  return new Promise((resolve, reject) => {
    const child = execFile('node', [`${__dirname}/job.js`,  '--unhandled-rejection=strict', JSON.stringify(args)], (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else if (stderr) {
        reject(stderr);
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(e);
        } finally {
          child.kill();
          children = children.filter(x => x !== child);
        }
      }
    });

    children.push(child);
  })
}
