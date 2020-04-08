const { parse } = require('url');
const ora = require('ora');
const fs = require('fs');
const print = require('./lib/stats');
const workerpool = require('workerpool');
const EXPERIMENT = true;
const CONTROL = false;

const inputUrl = process.env.URL;
const { protocol, host, path } = parse(inputUrl);
const options = {
  NO_GZIP: process.env.NO_GZIP,
  URL: process.env.URL,
  COOKIE: process.env.COOKIE,
  HTTP_V1: process.env.HTTP_V1,
  host,
  protocol,
  path,
  DEV_ENV: process.env.DEV_ENV,
};

if (!inputUrl) {
  throw new Error(
    'We expected the URL environment variable, but it was not set'
  );
}

if (!('COOKIE' in options)) {
  throw new Error(
    'We expected the COOKIE environment variable, but it was not set'
  );
}

if (options.HTTP_V1)  {
  console.log('HTTP: v1.1');
} else {
  console.log('HTTP: v2 (use: HTTP_V1=1 to use http v1.1)');
}

if (options.NO_GZIP)  {
  console.log('GZIP: off');
} else {
  console.log('GZIP: on (use NO_GZIP=1 to disable)');
}
(async function main() {
  const COUNT = Number(process.env.COUNT) || 10;
  console.log(
    `Running: '${COUNT}' Samples (EXPERIMENT vs CONTROL) for the url ${protocol}//${host}${path}`
  );
  const spinner = ora('running').start();

  spinner.start();

  // spawn new pool, it seemed like node was having issues due to shared state between requests..
  // measurements are still only based on content download time approximation and wont be affected by process start/stop times
  const pool = workerpool.pool(__dirname + '/lib/worker.js');
  const experiment = [];
  const control = [];

  try {
    for (let i = 0; i < COUNT; i++) {
      spinner.text = `running [EXPERIMENT] iteration: ${i}`;
      experiment.push(await pool.exec('test', [EXPERIMENT, options]));
      spinner.text = `running [CONTROL] iteration: ${i}`;
      control.push(await pool.exec('test', [CONTROL, options]));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

  } finally{
    spinner.stop();
    pool.terminate();
  }

  fs.writeFileSync('out.csv', [
    ['iteration', 'scenario', 'ms'].join(','),
    ...experiment.map((x,i) => [i, 'experiment', x.contentDownload].join(',')),
    ...control.map((x,i) => [i, 'control', x.contentDownload].join(',')),
  ].join('\n'));

  print(
  `Content Download: ${inputUrl}`,
    control.map(x => x.contentDownload),
    experiment.map(x => x.contentDownload)
  );
  // confidence interval is as wide as the expected affect size
  console.log(`raw data written to: ${__dirname}/out.csv`)
}());
