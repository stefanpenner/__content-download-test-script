'use strict';

const { Stats, convertMSToMicroseconds } = require('@tracerbench/stats');
function sevenFigureSummary(summary) {
  return ['[',
    `min: ${summary.min} `,
    `10: ${summary['10']} `,
    `25: ${summary['25']} `,
    `50: ${summary['50']} `,
    `75: ${summary['75']} `,
    `90: ${summary['90']} `,
    `max: ${summary.max}`,
    ']',
  ].join('')
}

module.exports = function print(name, control, experiment) {
  const stats = new Stats({
    // Ensure these are microseconds
    control: control.map(convertMSToMicroseconds),
    experiment: experiment.map(convertMSToMicroseconds),
    name
  });

  console.log(`${stats.name}: `);
  console.log('  - samples:    %o: ', stats.sampleCount);
  console.log('  - control:    %s: ', stats.sparkLine.control, sevenFigureSummary(stats.sevenFigureSummary.control));
  console.log('  - experiment: %s: ', stats.sparkLine.experiment, sevenFigureSummary(stats.sevenFigureSummary.experiment));
  console.log('  - confidence: %o',   stats.confidenceInterval);
  console.log('  - range: %o',        stats.range);
  console.log('  - effect estimate: %o',    stats.estimator);
}
