/**
 * @todo more robust findParrotRequest
*/
const http = require('http');
const { createMessageApi: createMessage, postMessage } = require('./bot');
const { consoleOut } = require('./util');

const isChallenge = body => Boolean(body.challenge);
const findParrotRequest = ({ event: { text, channel } }) => ({
  user: text.match(/<@\w{9}>(?!.*<@\w{9}>)/),
  channel,
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
    const parrotRequest = findParrotRequest(body);
    if (parrotRequest.user !== null) {
      const userId = parrotRequest.user[0].slice(2, 11);
      const { channel } = parrotRequest;
      return createMessage({ id: userId }, {}, (error, result) => {
        if (result) {
          return postMessage(result, channel, consoleOut);
        }
        console.error(error);
        return postMessage('sorry something went wrong', channel, consoleOut);
      });
    }
    response.statusCode = 401;
    return response.end('I can only handle parrot requests and challenges');
  });
}).listen(port, () => console.log(`listening on ${port}`));
