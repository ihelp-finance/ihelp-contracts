module.exports = {
  "peephole": false,
  "inliner": false,
  "jumpdestRemover": false,
  "orderLiterals": true,
  "deduplicate": false,
  "cse": false,
  "constantOptimizer": false,
  "configureYulOptimizer": true,
  "skipFiles": ["testing/"],
  "istanbulReporter": ["html", "json-summary"]
};
