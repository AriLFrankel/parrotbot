const fs = require('fs');
const fetch = require('isomorphic-unfetch');

require('dotenv').config();

class Chadbot {

  constructor() {
    this.relationships = {};
    this.terminals = new Set();
    this.starts = [];
    this.userIdsMap = {
      ariCreatorCircle: process.env.ariCreatorCircle,
      chadConcierge: process.env.chadConcierge,
      jacobConcierge: process.env.jacobConcierge,
      bradConcierge: process.env.bradConcierge,
    };
    this.channelsMap = {
      conciergeCompanyWide: process.env.conciergeCompanyWide,
      creatorCircleGeneral: process.env.creatorCircleGeneral,
      conciergeProductTeam: process.env.conciergeProductTeam,
    };
  }


  async getUsers (userName) {
    const users = await fetch(`https://slack.com/api/users.list?token=${process.env.ARICC_TOKEN}&pretty=1`);
    return users.json()
      .then(json => json.members.find(member => member.name.includes(userName)));
  };

  capitalize (word) {
    if (!word.length) return word;
    return `${word[0].toUpperCase()}${word.slice(1)}`;
  }

  async storeMessages() {
    try {
      const allMessages = [];
      const userId = this.userIdsMap.jacobConcierge;
      const channels = [this.channelsMap.conciergeProductTeam];
      // fetch all of user's messages
      for (const channel of channels) {
        const eventsAndMessages = await fetch(`https://slack.com/api/channels.history?token=${process.env.CONCIERGE_BOT_TOKEN}&channel=${channel}&count=10000&pretty=1`);
        const json = await eventsAndMessages.json();
        if(!json.ok) throw new Error(json.error);

        const messages = json.messages
          .reduce((messages, message) => {
            if (message.type === 'message' && message.text.length) {
              const text = message.text
                .replace(/<[^>]*>/g, "")
                .replace(/[^a-zA-Z0-9:\-\ ]/g,"")
                .replace(/\ +/g, " ")
                .replace(/^ /, "")
                .toLowerCase()
              if(text.length) messages.push(text)
              return messages;
            }
          }, []);
        allMessages.push(...messages)
      }
      // write JSON to file
      fs.writeFileSync('allMessages.json', JSON.stringify(allMessages)); 
      return Promise.resolve(allMessages);
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  makeRandomChoice (array) {
    return array[Math.floor(array.length * Math.random())]
  }

  parseCorpus() {
    // read JSON corpus from file
    this.corpus = JSON.parse(fs.readFileSync('allMessages.json'));
    // parse corpus
    let terminals = new Set();
    let starts = [];
    let relationships = {};

    for (let i = 0; i < this.corpus.length; i++) {
      const words = this.corpus[i].split(' ')
      terminals.add(words.slice(-2).join(' '));
      starts.push(words.slice(0,2).join(' '));
      for (let j = 0; j < words.length - 1; j++) {
        if (relationships.hasOwnProperty(words.slice(j, j + 2).join(' '))) {
          relationships[words.slice(j, j + 2).join(' ')].push(words.slice(j + 2, j + 4).join(' '));
        } else {
          relationships[words.slice(j, j + 2).join(' ')] = [words.slice(j + 2, j + 4).join(' ')];
        }
      }
    }

    this.terminals = terminals;
    this.starts = starts;
    this.relationships = relationships;
  }

  createMessage(maxLength = 20, minLength = 3) {
    const { starts, terminals, relationships } = this;

    // start a sentence with a random choice from the starts
    let currentWord = this.makeRandomChoice(starts)

    // while(currentWord === '-' || currentWord === '') {
    //   currentWord = this.makeRandomChoice(starts).join('');
    // }

    let nextWord;
    const sentence = [this.capitalize(currentWord)];
    // continue adding randomly chosen follower words
    // until a terminating word is found or minimum length has been reached
    while(relationships.hasOwnProperty(currentWord)) {
      nextWord = this.makeRandomChoice(relationships[currentWord]);
      sentence.push(nextWord);
      currentWord = nextWord;
      if(this.terminals.has(currentWord) || sentence.length >= maxLength) {
        break;
      }
    }
    // recurse if not long enough of a sentence
    const len = sentence.filter(w => w).join(' ').replace(/\s+/g, ' ').split(' ').length
    if (len < minLength) return this.createMessage(maxLength, minLength);
    return sentence.join(' ').replace(/\s+/g, ' ').split(' ').filter(w => w).join(' ') + '.';
  }
};

module.exports = new Chadbot();