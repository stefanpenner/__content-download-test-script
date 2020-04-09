'use strict';

const workerpool = require('workerpool');

const { execFile } = require('child_process');

module.exports = function(args) {
  return new Promise((resolve, reject) => {
    execFile('node', [`${__dirname}/job.js`,  '--unhandled-rejection=strict', JSON.stringify(args)], (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(e);
        }
      }
    });
  })
}
