const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

// Auth endpoints
app.post('/api/auth/register', (req, res) => {
  const { email, password, username } = req.body;
  res.status(201).json({ 
    id: 'user-' + Date.now(), 
    email, 
    username,
    token: 'mock-jwt-token-' + Date.now(),
    createdAt: new Date().toISOString()
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  res.json({ 
    id: 'user-123', 
    email, 
    username: 'mockuser',
    token: 'mock-jwt-token-' + Date.now(),
    roles: ['user'],
    permissions: ['read:profile', 'write:profile']
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Profile endpoints
app.get('/api/users/profile', (req, res) => {
  res.json({ 
    id: 'user-123', 
    email: 'mock@example.com', 
    username: 'mockuser',
    firstName: 'Mock',
    lastName: 'User',
    avatar: 'https://example.com/avatar.jpg',
    roles: ['user'], 
    permissions: ['read:profile', 'write:profile'],
    createdAt: '2024-01-01T00:00:00Z',
    lastLoginAt: new Date().toISOString()
  });
});

app.put('/api/users/profile', (req, res) => {
  const updates = req.body;
  res.json({ 
    id: 'user-123',
    ...updates,
    updatedAt: new Date().toISOString()
  });
});

// Token validation endpoint (used by API Gateway)
app.post('/api/auth/validate', (req, res) => {
  const { token } = req.body;
  if (token && token.startsWith('mock-jwt-token')) {
    res.json({ 
      valid: true,
      user: {
        id: 'user-123', 
        email: 'mock@example.com', 
        username: 'mockuser',
        roles: ['user'], 
        permissions: ['read:profile', 'write:profile']
      }
    });
  } else {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`user-service mock on ${port}`));

