const { exec } = require('child_process');
const fs = require('fs');
const { promisify } = require('util');

const writeToFile = promisify(fs.writeFile);
const readFromFile = promisify(fs.readFile);
const execPromise = promisify(exec);

/* eslint-disable no-console */
const consoleOut = (error, response) => {
  if (error) console.error(error);
  if (response) console.log(response);
};
/* eslint-enable no-console */

const pluck = (props, obj) => (Array.isArray(props)
  ? props.reduce((acc, p) => {
    acc[p] = obj[p];
    return acc;
  }, {})
  : { [props]: obj[props] });

const flatten = arrays => arrays.reduce((acc, cur) => {
  if (cur.constructor === Array) return acc.concat(flatten(cur));
  acc.push(cur);
  return acc;
}, []);

const capitalize = w => (w.length
  ? `${w[0].toUpperCase()}${w.slice(1)}`
  : w);

const makeRandomChoice = a => a[Math.floor(a.length * Math.random())];

const stripSpecial = w => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

module.exports = {
  capitalize,
  consoleOut,
  exec,
  execPromise,
  flatten,
  makeRandomChoice,
  pluck,
  readFromFile,
  stripSpecial,
  writeToFile,
};
