'use strict';

const workerpool = require('workerpool');

workerpool.worker({
  test: require('./test'),
});
