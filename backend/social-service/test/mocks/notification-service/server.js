const http = require('http');
const url = require('url');

// Mock notification storage
const notifications = [];
const userPreferences = new Map();

// Default preferences
const defaultPreferences = {
  friendRequests: { enabled: true, methods: ['push', 'email'] },
  friendRequestAccepted: { enabled: true, methods: ['push'] },
  newMessages: { enabled: true, methods: ['push'], onlyWhenOffline: true },
  achievements: { enabled: true, methods: ['push', 'email'] }
};

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
    res.end(JSON.stringify({ status: 'ok', service: 'notification-service-mock' }));
    return;
  }

  // Send notification
  if (path === '/v1/notifications/send' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const notification = JSON.parse(body);
        
        // Validate required fields
        if (!notification.userId || !notification.type || !notification.title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_FIELDS', message: 'userId, type, and title are required' }));
          return;
        }

        // Store notification
        const notificationRecord = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...notification,
          createdAt: new Date().toISOString(),
          status: 'sent'
        };
        
        notifications.push(notificationRecord);
        
        console.log(`📧 Notification sent: ${notification.type} to user ${notification.userId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          notificationId: notificationRecord.id,
          message: 'Notification sent successfully' 
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Send batch notifications
  if (path === '/v1/notifications/batch' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { notifications: batchNotifications } = JSON.parse(body);
        
        if (!Array.isArray(batchNotifications)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_FORMAT', message: 'notifications must be an array' }));
          return;
        }

        const results = batchNotifications.map(notification => {
          const notificationRecord = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...notification,
            createdAt: new Date().toISOString(),
            status: 'sent'
          };
          
          notifications.push(notificationRecord);
          console.log(`📧 Batch notification sent: ${notification.type} to user ${notification.userId}`);
          
          return { success: true, notificationId: notificationRecord.id };
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          results,
          message: `${results.length} notifications sent successfully` 
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Get user notification preferences
  if (path.startsWith('/v1/users/') && path.endsWith('/preferences') && method === 'GET') {
    const userId = path.split('/')[3];
    
    const preferences = userPreferences.get(userId) || defaultPreferences;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      userId,
      preferences,
      updatedAt: new Date().toISOString()
    }));
    return;
  }

  // Update user notification preferences
  if (path.startsWith('/v1/users/') && path.endsWith('/preferences') && method === 'PUT') {
    const userId = path.split('/')[3];
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { preferences } = JSON.parse(body);
        
        userPreferences.set(userId, { ...defaultPreferences, ...preferences });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Preferences updated successfully'
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Get notification history for user
  if (path.startsWith('/v1/users/') && path.endsWith('/notifications') && method === 'GET') {
    const userId = path.split('/')[3];
    
    const userNotifications = notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50); // Last 50 notifications
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      notifications: userNotifications,
      total: userNotifications.length
    }));
    return;
  }

  // Get all notifications (for testing)
  if (path === '/v1/notifications' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      notifications: notifications.slice(-100), // Last 100 notifications
      total: notifications.length
    }));
    return;
  }

  // Clear notifications (for testing)
  if (path === '/v1/notifications/clear' && method === 'DELETE') {
    notifications.length = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'All notifications cleared' }));
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Endpoint not found' }));
});

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`Mock Notification Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Mock Notification Service...');
  server.close(() => {
    process.exit(0);
  });
});