'use strict';
const http = require('https');
const http2 = require('http2');
const jsdom = require('jsdom');
const zlib = require('zlib')

module.exports = async function test(isExperiment, options) {
  const lixCookie =  isExperiment ? 'lror="pemberly.bpr.useFastlane=enabled"': 'lror="pemberly.bpr.useFastlane=control"';
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
    cookie: `${options.COOKIE}; ${lixCookie}`,
  };
  const timings = {
    initial: 0,
    complete: 0,
    flushes: 0,
    contentDownload: 0
  };
  const start = Date.now();

  return new Promise((resolve, reject) => {
    let initial = start;
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
        authority: options.host,
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
        cookie: `${process.env.COOKIE}; `,
      });

      // request.on('response', () => { initial = Date.now(); })
      request.on('data', onData);
      request.on('error', reject);

      request.on('end', () => {
        onEnd();
        connection.close();
      });
    }
  });
}

