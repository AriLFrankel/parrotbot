const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/* eslint-disable no-console */
const consoleOut = (error, response) => {
  if (error) console.error(error);
  if (response) console.log(response);
};
/* eslint-enable no-console */

/**
 * A helper function for plucking properties off of an object.
 * Accepts an array of propreties or a single property
 * @param {string[] | string} props
 * @param {obj} obj
 */
const pluck = (props, obj) => (Array.isArray(props)
  ? props.reduce((acc, p) => {
    acc[p] = obj[p];
    return acc;
  }, {})
  : { [props]: obj[props] });
/**
 * A helper function for flattening arrays
 * @param {array[]} arrays
 */
const flatten = arrays => arrays.reduce((acc, cur) => {
  if (cur.constructor === Array) return acc.concat(flatten(cur));
  acc.push(cur);
  return acc;
}, []);

/**
 * A helper function for capitalizing words
 * @param {string} w
 */

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
  stripSpecial,
};
