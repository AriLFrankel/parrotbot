/**
 * @file contains interactions with Slack and generation of phrases
 */

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable import/no-extraneous-dependencies
  require('dotenv').config();
}

const { BOT_TOKEN: token } = process.env;
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
 * A helper function for fetching properties of a user
 * @param {object} query
 * @param {string?} query.id
 * @param {string?} query.name
 * @param {string[] | string} props
 * @returns {Promise.<object>}
 */
const getUser = (props, query = {}) => execPromise(`curl https://slack.com/api/users.list?token=${token}&pretty=1`)
  .then(({ stdout }) => JSON.parse(stdout))
  .then(({ members }) => members.find(m => Object.entries(query)
    .reduce((acc, [key, val]) => acc && m[key] === val, true)))
  .then(prof => (props ? pluck(props, prof) : prof));

const getUserId = query => getUser(['id'], query).then(u => u.id);

/**
 * A helper function for fetching channels in a workspace
 * @param {string[]} props
 * @returns {Promise.<string[]>}
 */
const getChannels = (props, query = {}) => execPromise(`curl https://slack.com/api/channels.list?token=${token}&pretty=1`)
  .then(({ stdout }) => JSON.parse(stdout))
  .then(({ channels }) => channels.filter(c => Object.entries(query)
    .reduce((acc, [key, val]) => acc && c[key] === val, true)))
  .then(channels => channels.map(channel => (props
    ? pluck(props, channel)
    : channel)));

const getChannelIds = query => getChannels(['id'], query).then(channels => channels.map(c => c.id));

/**
 * A helper function for fetching messages in a channel
 * @param string user
 * @param string channel
 * @returns {Promise.<string[]>}
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
 * A helper function for getting all messages belonging to a user.
 * @param {string} user
 * @param {string} channels
 * @returns {Promise.<string[]>}
 */
const getAllMessages = (user, channels) => (Array.isArray(channels)
  ? Promise.all(channels.map(c => getMessages(user, c)))
    .then(flatten)
  : getMessages(user, channels));

/**
 * A helper function for a two word phrase map of a corpus
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
 * A helper function for generating random message from a mapped out corpus.
 * Takes a random walk from a start word => recurse on the map of words
 * that could follow => terminals or max length reached
 * @param {string} parsedCorpus
 * @param {number} maxLength
 * @param {number} minLength
 * @returns {string} message
 */
const createMessage = (
  parsedCorpus,
  maxLength = process.env.MAX_LENGTH,
  minLength = process.env.MIN_LENGTH,
) => {
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
  // try again if a sentence of insufficient length is produced
  if (sentence.length < minLength) return createMessage(parsedCorpus, maxLength, minLength);
  return `${sentence.join(' ')}.`;
};

const createMessageApi = (userQuery, channelQuery, callback) => Promise.all([
  getUserId(userQuery),
  getChannelIds(channelQuery),
])
  .then(([user, channels]) => getAllMessages(user, channels))
  .then(flatten)
  .then(parseCorpus)
  .then(createMessage)
  .then(res => callback(null, res))
  .catch(err => callback(err));

const postMessage = (text, channel, callback) => {
  exec(`curl -X POST -H 'Authorization: Bearer ${token}'\
  -H 'Content-Type: application/json' \
  --data '${JSON.stringify({ channel, text })}' https://slack.com/api/chat.postMessage`, callback);
};

module.exports = {
  createMessageApi,
  postMessage,
};
