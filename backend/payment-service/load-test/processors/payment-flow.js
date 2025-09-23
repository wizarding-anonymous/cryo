'use strict';

const { v4: uuid } = require('uuid');

module.exports = {
  generateOrder(context, events, done) {
    context.vars.gameId = context.vars.gameId || uuid();
    context.vars.provider = context.vars.provider || 'sberbank';
    return done();
  },
};
