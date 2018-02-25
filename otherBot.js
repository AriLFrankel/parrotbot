/**
 * @todo: handle errors
 * @todo: documentation with JSDoc
 * gameplan:
 * hook up to RTM
 * send a loading status on start
 * send over the complete message on ready
 */

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable import/no-extraneous-dependencies
  require('dotenv').config();
}

const { SLACK_TOKEN: token } = process.env;
const {
  capitalize,
  execPromise,
  exec,
  flatten,
  makeRandomChoice,
  pluck,
  stripSpecial,
} = require('./util');

/**
 *
 * @param {id?: string, name?: string} query
 * @param [string] | string props
 * @returns {promise} profile
 */
const getUser = (props, query) => execPromise(`curl https://slack.com/api/users.list?token=${token}&pretty=1`)
  .then(({ stdout }) => JSON.parse(stdout))
  .then(({ members }) => members.find(m => Object.entries(query)
    .reduce((acc, [key, val]) => acc && m[key] === val, true)))
  .then(prof => (props ? pluck(props, prof) : prof));

const getUserId = query => getUser(['id'], query).then(u => u.id);

/**
 *
 * @param [string] props
 * @returns {promise} [channel]
 */
const getChannels = (props, query) => execPromise(`curl https://slack.com/api/channels.list?token=${token}&pretty=1`)
  .then(({ stdout }) => JSON.parse(stdout))
  .then(({ channels }) => channels.filter(c => Object.entries(query)
    .reduce((acc, [key, val]) => acc && c[key] === val, true)))
  .then(channels => channels.map(channel => (props
    ? pluck(props, channel)
    : channel)));

const getChannelIds = query => getChannels(['id'], query).then(channels => channels.map(c => c.id));

/**
 *
 * @param string user
 * @param string channel
 * @returns {promise} [message]
 */
const getMessages = (user, channel) => new Promise((resolve) => {
  const allMessages = [];
  (function callExec(stamp) {
    exec(`curl \
      --data-urlencode "token=${token}"\
      --data-urlencode "channel=${channel}"\
      --data-urlencode "count=10"\
      --data-urlencode "pretty=1"\
      ${stamp ? `--data-urlencode "latest=${stamp}"` : ''}\
      https://slack.com/api/channels.history`, (error, stdout) => {
      const json = JSON.parse(stdout);
      const userMessages = json.messages.filter(m =>
        m.type === 'message' &&
          m.user === user &&
          !m.text.includes('added an integration to this channel'));
      allMessages.push(userMessages.map(m => pluck(['text', 'type'], m)));
      if (json.has_more) {
        const { ts } = json.messages.slice(-1)[0];
        callExec(ts);
      } else {
        // all messages have been retrieved
        resolve(allMessages);
      }
    });
  }());
});

/**
 *
 * @param {string} user
 * @param {string} channels
 * @returns Promise<[message]>
 */
const getAllMessages = (user, channels) => (Array.isArray(channels)
  ? Promise.all(channels.map(c => getMessages(user, c)))
    .then(flatten)
  : getMessages(user, channels));

/**
 *
 * @param {string} file
 * @returns {object}
 */
const parseCorpus = (corpus) => {
  const terminals = new Set();
  const starts = [];
  const relationships = {};
  for (let i = 0; i < corpus.length; i += 1) {
    const words = corpus[i].text.split(' ').map(stripSpecial);
    terminals.add(words.slice(-2).join(' '));
    starts.push(words.slice(0, 2).join(' '));
    for (let j = 0; j < words.length - 1; j += 1) {
      const firstPhrase = words.slice(j, j + 2).join(' ');
      const secondPhrase = words.slice(j + 2, j + 4).join(' ');
      if (relationships[firstPhrase]) {
        relationships[firstPhrase].push(secondPhrase);
      } else {
        relationships[firstPhrase] = [secondPhrase];
      }
    }
  }
  return { terminals, starts, relationships };
};

/**
 *
 * @param {string} parsedCorpus
 * @param {number} maxLength
 * @param {number} minLength
 * @returns {string} message
 */
const createMessage = (parsedCorpus, maxLength = 20, minLength = 7) => {
  const { starts, terminals, relationships } = parsedCorpus;
  let currentWord = makeRandomChoice(starts);
  let nextWord;
  const sentence = [capitalize(currentWord)];
  // continue adding randomly chosen follower words
  // until a terminating word is found or minimum length has been reached
  while (relationships[currentWord]) {
    nextWord = makeRandomChoice(relationships[currentWord]);
    sentence.push(nextWord);
    currentWord = nextWord;
    if (terminals.has(currentWord) || sentence.length >= maxLength) {
      break;
    }
  }

  if (sentence.length < minLength) return createMessage(parsedCorpus, maxLength, minLength);
  return `${sentence.join(' ')}.`;
};

Promise.all([
  getUserId({ name: 'ari' }),
  getChannelIds({ name: 'general' }),
])
  .then(([user, channels]) => getAllMessages(user, channels))
  .then(flatten)
  .then(parseCorpus)
  .then(createMessage)
  .then(console.log);
