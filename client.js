const http = require('https');
const http2 = require('http2');
const { parse } = require('url');
const jsdom = require('jsdom');
const ora = require('ora');
const fs = require('fs');
const print = require('./lib/stats');
const zlib = require('zlib')

const EXPERIMENT = true;
const CONTROL = false;
const rejectUnauthorized = process.env.DEV_ENV ? false : true;

const inputUrl = process.env.URL;
const { protocol, host, path } = parse(inputUrl);
const options = {
  NO_GZIP: process.env.NO_GZIP,
  URL: process.env.URL,
  COOKIE: process.env.COOKIE,
  HTTP_V1: process.env.HTTP_V1,
  host,
  protocol,
  path
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

async function test(isExperiment, options) {
  const lixCookie = isExperiment ? 'lror="pemberly.bpr.useFastlane=enabled"': 'lror="pemberly.bpr.useFastlane=control"';
  const headers = {
    authority: options.host,
    pragma: 'no-cache',
    'cache-control': 'no-cache',
    'upgrade-insecure-requests': '1',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
    'sec-fetch-dest': 'document',
    'accept-encoding': options.NO_GZIP ? '' : 'gzip, deflate, br',
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-user': '?1',
    'accept-language': 'en-US,en;q=0.9',
    cookie: `${options.COOKIE}; ${lixCookie}`,
  };
  const timings = {
    initial: 0,
    complete: 0,
    flushes: 0,
  };
  const start = Date.now();
  let initial;

  return new Promise((resolve, reject) => {
    const chunks = [];
    function onData(chunk) {
      timings.flushes++;
      chunks.push(chunk);
    }

    function onEnd() {
      timings.contentDownload = Date.now() - initial;
      timings.total = Date.now() - start;
      let body;

      if (options.NO_GZIP) {
        body = chunks.join('');
      } else {
        body = zlib.unzipSync(Buffer.concat(chunks)).toString();
      }

      timings.length = body.length;

      const hasFastlane = new jsdom.JSDOM(
        body
      ).window.document.querySelector('meta[name=Fastlane]');

      if (isExperiment === true && hasFastlane === false) {
        throw new Error(
          'expected Fastlane meta tag to be present when in the enabled cohort'
        );
      }

      if (isExperiment === false && hasFastlane === true) {
        throw new Error(
          'did NOT expected Fastlane meta tag to be present when in the control cohort'
        );
      }

      resolve(timings);
    }

    if (process.env.HTTP_V1)  {
      http.get(
        `${options.protocol}//${options.host}${options.path}`,
        {
          credentials: 'include',
          rejectUnauthorized,
          headers,
          referrerPolicy: 'no-referrer-when-downgrade',
          mode: 'cors',
        },
        (res) => {
          initial = Date.now();
          timings.initial = initial - start;

          if (res.statusCode !== 200) {
            throw new Error(`Expected http 200, but got: ${res.statusCode}`);
          }

          res.on('data', onData);
          res.on('error', reject);
          res.on('end', onEnd);
        }
      );
    } else {
      const connection = http2.connect(`${options.protocol}//${options.host}${options.path}`);
      connection.on('error', reject);
      const request = connection.request({
        authority: host,
        pragma: 'no-cache',
        'cache-control': 'no-cache',
        'upgrade-insecure-requests': '1',
        'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
        'sec-fetch-dest': 'document',
        'accept-encoding': 'gzip, deflate, br',
        accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'accept-language': 'en-US,en;q=0.9',
        cookie: `${process.env.COOKIE}; ${lixCookie}`,
      });

      request.on('response', () => { initial = Date.now(); })
      request.on('data', onData);
      request.on('error', reject);

      request.on('end', () => {
        onEnd();
        connection.close();
      });

      request.on('close', () => {
        onEnd();
        connection.close();
      });
    }
  });
}

(async function main() {
  const COUNT = Number(process.env.COUNT) || 10;
  console.log(
    `Running: '${COUNT}' Samples (EXPERIMENT vs CONTROL) for the url ${protocol}//${host}${path}`
  );
  const spinner = ora('running').start();

  spinner.start();
  const experiment = [];

  const control = [];

  for (let i = 0; i < COUNT; i++) {
    spinner.text = `running [EXPERIMENT] iteration: ${i}`;
    experiment.push(await test(EXPERIMENT, options));
    spinner.text = `running [CONTROL] iteration: ${i}`;
    control.push(await test(CONTROL, options));
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  spinner.stop();

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
