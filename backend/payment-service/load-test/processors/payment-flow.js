const { v4: uuidv4 } = require('uuid');

module.exports = {
  // Generate random test data
  generateTestData,
  // Custom functions for Artillery
  $randomString,
  $randomInt,
  $randomAmount,
  $randomProvider,
  $randomGameId,
  // Hooks
  beforeRequest,
  afterResponse,
};

function generateTestData(userContext, events, done) {
  // Generate test user data
  userContext.vars.userId = uuidv4();
  userContext.vars.correlationId = uuidv4();
  
  // Generate random test data
  userContext.vars.gameId = $randomGameId();
  userContext.vars.gameName = `Load Test Game ${$randomInt(1, 1000)}`;
  userContext.vars.amount = $randomAmount();
  userContext.vars.provider = $randomProvider();
  
  return done();
}

function $randomString() {
  return Math.random().toString(36).substring(2, 15);
}

function $randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function $randomAmount() {
  const amounts = [499, 999, 1499, 1999, 2999, 4999, 9999];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

function $randomProvider() {
  const providers = ['sberbank', 'yandex', 'tbank'];
  return providers[Math.floor(Math.random() * providers.length)];
}

function $randomGameId() {
  return uuidv4();
}

function beforeRequest(requestParams, context, ee, next) {
  // Add correlation ID to all requests
  if (!requestParams.headers) {
    requestParams.headers = {};
  }
  
  requestParams.headers['x-correlation-id'] = context.vars.correlationId || uuidv4();
  requestParams.headers['x-load-test'] = 'true';
  
  // Add realistic user agent
  requestParams.headers['User-Agent'] = 'Artillery Load Test / Payment Service';
  
  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  // Log errors for debugging
  if (response.statusCode >= 400) {
    console.log(`Error ${response.statusCode} for ${requestParams.url}: ${response.body}`);
  }
  
  // Track custom metrics
  if (response.headers['x-response-time']) {
    ee.emit('customStat', 'response_time', parseFloat(response.headers['x-response-time']));
  }
  
  return next();
}