const http = require('http');
const url = require('url');

// Mock user database
const users = new Map([
  ['user-1', { id: 'user-1', username: 'TestUser1', email: 'user1@test.com', avatar: 'https://example.com/avatar1.jpg' }],
  ['user-2', { id: 'user-2', username: 'TestUser2', email: 'user2@test.com', avatar: 'https://example.com/avatar2.jpg' }],
  ['user-3', { id: 'user-3', username: 'TestUser3', email: 'user3@test.com', avatar: 'https://example.com/avatar3.jpg' }],
  ['user-4', { id: 'user-4', username: 'PlayerOne', email: 'player1@test.com', avatar: 'https://example.com/avatar4.jpg' }],
  ['user-5', { id: 'user-5', username: 'PlayerTwo', email: 'player2@test.com', avatar: 'https://example.com/avatar5.jpg' }],
]);

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-token');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'user-service-mock' }));
    return;
  }

  // Get user by ID
  if (path.startsWith('/v1/users/') && method === 'GET') {
    const userId = path.split('/')[3];
    const user = users.get(userId);
    
    if (user) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(user));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'USER_NOT_FOUND', message: 'User not found' }));
    }
    return;
  }

  // Get multiple users by IDs
  if (path === '/v1/users/batch' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { userIds } = JSON.parse(body);
        const foundUsers = userIds.map(id => users.get(id)).filter(Boolean);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ users: foundUsers }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Search users
  if (path === '/v1/users/search' && method === 'GET') {
    const query = parsedUrl.query.q;
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'MISSING_QUERY', message: 'Search query is required' }));
      return;
    }

    const searchResults = Array.from(users.values())
      .filter(user => user.username.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10); // Limit to 10 results

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users: searchResults }));
    return;
  }

  // Validate JWT token
  if (path === '/v1/auth/validate' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { token } = JSON.parse(body);
        
        // Mock JWT validation - in real service this would validate the actual JWT
        if (token && token.startsWith('test-token-')) {
          const userId = token.replace('test-token-', '');
          const user = users.get(userId);
          
          if (user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: true, user }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: false, error: 'INVALID_TOKEN' }));
          }
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, error: 'INVALID_TOKEN' }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Endpoint not found' }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Mock User Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Mock User Service...');
  server.close(() => {
    process.exit(0);
  });
});