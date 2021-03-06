'use strict';
const http = require('https');
const http2 = require('http2');
const jsdom = require('jsdom');
const zlib = require('zlib'); const hasFastlaneMeta = require('./has-fastlane-meta');

const LIX_COOKIES = {
  'CONTROL':  'lror="pemberly.bpr.useFastlane=control"',
  'EXPERIMENT': 'lror="pemberly.bpr.useFastlane=enabled"'
};

module.exports = async function test(scenario, options) {
  const lixCookie = LIX_COOKIES[scenario];
  if (!lixCookie) {
    throw new Error(`Unknown scenario: ${scenario}`)
  }
  const rejectUnauthorized = options.DEV_ENV ? false : true;

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
    cookie: `${options.COOKIE}; ${lixCookie};`,
  };

  const timings = {
    initial: 0,
    complete: 0,
    flushes: 0,
    contentDownload: 0
  };
  const start = Date.now();

  return new Promise((resolve, reject) => {
    let initial;
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
      const hasFastlane = hasFastlaneMeta(body)
      if (scenario === "EXPERIMENT" && hasFastlane === false) {
        throw new Error(
          'expected Fastlane meta tag to be present when in the enabled cohort'
        );
      }

      if (scenario ===  "CONTROL" && hasFastlane === true) {
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
      const request = connection.request(headers);
      const errored = false;

      request.on('response', res => {
        if (res[':status']!== 200) {
          throw new Error(`Expected http 200, but got: ${res[':status']}`);
        }

        initial = Date.now();
      })
      request.on('data', onData);
      request.on('error', error => {
        errored = true;
        reject(error);
        connection.close();
      });

      request.on('end', () => {
        if (errored === false) {
          onEnd();
          connection.close();
        }
      });
    }
  });
}

