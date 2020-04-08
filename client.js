const http = require('https');
const http2 = require('http2');
const { parse } = require('url');
const jsdom = require('jsdom');
const ora = require('ora');
const fs = require('fs');
const print = require('./lib/stats');
const zlib = require('zlib')

const FASTLANE_ENABLED  = 'lror="pemberly.bpr.useFastlane=enabled"';
const FASTLANE_DISABLED = 'lror="pemberly.bpr.useFastlane=control"';

const EXPERIMENT = true;
const CONTROL = false;
const rejectUnauthorized = process.env.DEV_ENV ? false : true;

const inputUrl = process.env.URL;
if (!inputUrl) {
  throw new Error(
    'We expected the URL environment variable, but it was not set'
  );
}
const { protocol, host, path } = parse(inputUrl);

if (!('COOKIE' in process.env)) {
  throw new Error(
    'We expected the COOKIE environment variable, but it was not set'
  );
}

if (process.env.HTTP_V1)  {
  console.log('HTTPv1.1');
} else {
  console.log('HTTPv2');
}

async function test(isExperiment) {
  const lixCookie = isExperiment ? FASTLANE_ENABLED : FASTLANE_DISABLED;
  const headers = {
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
      const body = zlib.unzipSync(Buffer.concat(chunks)).toString();
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
        `${protocol}//${host}${path}`,
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
      const connection = http2.connect(`${protocol}//${host}${path}`);
      const chunks = [];
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
    experiment.push(await test(EXPERIMENT));
    spinner.text = `running [CONTROL] iteration: ${i}`;
    control.push(await test(CONTROL));
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