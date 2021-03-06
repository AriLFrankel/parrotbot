/**
 * @file node server for receiving Slack events
 * https://api.slack.com/events-api
*/
const http = require('http');
const { createMessageApi: createMessage, postMessage } = require('./bot');
const { consoleOut } = require('./util');

const { BOT_ID: botId } = process.env;
const cache = new Set();

/**
 * A helper function for determining if a request is a challenge from Slack
 * @param {object} body
 * @returns {boolean}
 */
const isChallenge = body => Boolean(body.challenge);

/**
 * A helper function for identifying parrot requests
 * and the target users of such requests
 * @param {object} event
 * @returns {object} event with target property added
 */
const findParrotRequest = (event) => {
  const r = new RegExp(`<@${botId}> parrot <@\\w{9}>`);
  return Object.assign(event, {
    target: r.test(event.text)
      ? event.text.match(/<@\w{9}>(?!.*<@\w{9}>)/)
      : null,
  });
};

/**
 * A helper function for parsing JSON request bodies.
 * @param {object} request
 * @param {object} response
 * @param {function} callback
 */
const parseJSONBody = (request, response, callback) => {
  let body = [];
  request.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    try {
      body = JSON.parse(body);
      callback(body);
    } catch (err) {
      response.statusCode = 401;
      response.end('come back with JSON');
    }
  });
};

const addRequestErrorHandler = r => r.on('request error', console.error);

/**
 * A function for attempting to generate a message imitating the user
 * and post it to the channel
 * @param {string} user
 * @param {string} channel
 */
const createAndPostMessage = (user, channel) => {
  const userId = user[0].slice(2, 11);
  return createMessage({ id: userId }, {}, (error, result) => {
    if (result) {
      return postMessage(result, channel, consoleOut);
    }
    console.error(error);
    return postMessage('sorry something went wrong', channel, consoleOut);
  });
};

const handleBadFormat = channel => postMessage('Please use the following format to request that I parrot someone, \n `@parrotbot parrot @PERSON`', channel, consoleOut);

const port = process.env.PORT || 8080;
// eslint-disable-next-line consistent-return
http.createServer((request, response) => {
  const { method } = request;
  if (method !== 'POST') {
    return response.end('I can only accept post requests');
  }
  addRequestErrorHandler(request);
  parseJSONBody(request, response, (body) => {
    // handle challenges
    if (isChallenge(body)) {
      response.setHeader('Content-Type', 'application/x-www-form-urlencoded');
      return response.end(body.challenge);
    }
    const { event, event_id: eventId } = body;
    // do caching
    if (cache.has(eventId)) {
      response.statusCode = 204;
      return response.end('come back with an original message');
    }
    cache.add(eventId);
    setTimeout(() => cache.delete(eventId), 60 * 1000);
    // handle Parrot requests
    const { channel, target } = findParrotRequest(event);
    if (target !== null) return createAndPostMessage(target, channel);
    return handleBadFormat(channel);
  });
}).listen(port, () => console.log(`listening on ${port}`));
