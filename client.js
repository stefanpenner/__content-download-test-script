const { parse } = require('url');
const ora = require('ora');
const fs = require('fs');
const print = require('./lib/stats');

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

const worker = require('./lib/worker');
(async function main() {
  const COUNT = Number(process.env.COUNT) || 10;
  console.log(
    `Running: '${COUNT}' Samples (EXPERIMENT vs CONTROL) for the url ${protocol}//${host}${path}`
  );
  const spinner = ora('running').start();

  spinner.start();
  const experiment = [];
  const control = [];

  try {
    for (let i = 0; i < COUNT; i++) {
      if (!process.env.NO_EXPERIMENT) {
        spinner.text = `running [EXPERIMENT] iteration: ${i}`;
        experiment.push(await worker(['EXPERIMENT', options]));
      }
      if (!process.env.NO_CONTROL) {
        spinner.text = `running [CONTROL] iteration: ${i}`;
        control.push(await worker(['CONTROL', options]));
      }
    }

  }  finally {
    spinner.stop();
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
