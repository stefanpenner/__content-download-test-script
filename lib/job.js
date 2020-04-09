'use strict';

(async function main([flag, args]) {
  console.log(JSON.stringify(await require('./test')(...(JSON.parse(args)))));
})(process.argv.slice(2));
