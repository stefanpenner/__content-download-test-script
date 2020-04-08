

const fs = require('fs');
const parse = require('csv-parse/lib/sync')
const print = require('./lib/stats');

const parsed = parse(fs.readFileSync('./out.csv', 'UTF8'));

const control = [];
const experiment = [];

parsed.shift(); // drop header

for (let [iteration, scenario, ms] of parsed) {
  if (scenario === 'experiment') {
    experiment.push(ms);
  } else if (scenario === 'control') {
    control.push(ms);
  } else {
    throw new Error(`Unknown Scenario: ${scenario}`)
  }
}

print('content download test script', control, experiment);
