/**
 * @todo break up into middleware
 * generally clean up code
 * document code
*/
const http = require('http');
const { createMessageApi: createMessage, postMessage } = require('./bot');
const { consoleOut } = require('./util');

const cache = new Set();

const isChallenge = body => Boolean(body.challenge);
const findParrotRequest = ({ event }) => Object.assign(event, {
  user: (/<@U9DM0PHJL> parrot <@\w{9}>/).test(event.text)
    ? event.text.match(/<@\w{9}>(?!.*<@\w{9}>)/)
    : null,
});

const port = process.env.PORT || 8080;
// eslint-disable-next-line consistent-return
http.createServer((request, response) => {
  const { method } = request;
  if (method !== 'POST') {
    return response.end('I can only accept post requests');
  }
  let body = [];
  request.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    const fail = () => {
      response.statusCode = 401;
      response.end('come back with JSON');
    };
    try {
      body = JSON.parse(body);
    } catch (err) {
      fail();
    }
    if (isChallenge(body)) {
      response.setHeader('Content-Type', 'application/x-www-form-urlencoded');
      return response.end(body.challenge);
    }
    const { event_id: eventId } = body;
    // Handle each message only once...Slack seems to send them multiple times
    if (cache.has(eventId)) {
      return response.end();
    }
    cache.add(eventId);
    setTimeout(() => cache.remove(eventId), 60 * 1000);
    const parrotRequest = findParrotRequest(body);
    const { channel } = parrotRequest;
    if (parrotRequest.user !== null) {
      const userId = parrotRequest.user[0].slice(2, 11);
      return createMessage({ id: userId }, {}, (error, result) => {
        if (result) {
          return postMessage(result, channel, consoleOut);
        }
        console.error(error);
        return postMessage('sorry something went wrong', channel, consoleOut);
      });
    }
    // handle an improperly formatted request
    return postMessage('Please use the following format to request that I parrot someone, \n `@super_duper_bot parrot @PERSON`', channel, consoleOut);
  });
}).listen(port, () => console.log(`listening on ${port}`));
