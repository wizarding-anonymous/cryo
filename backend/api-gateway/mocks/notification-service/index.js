const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.get('/api/notifications', (req, res) => {
  res.json({ 
    notifications: [
      { 
        id: 'notif-1', 
        title: 'Game Update Available', 
        message: 'Cyberpunk 2077 has a new update',
        type: 'update',
        read: false,
        createdAt: '2024-01-01T10:00:00Z'
      },
      { 
        id: 'notif-2', 
        title: 'Friend Request', 
        message: 'John Doe sent you a friend request',
        type: 'social',
        read: true,
        createdAt: '2024-01-01T09:00:00Z'
      }
    ]
  });
});

app.post('/api/notifications', (req, res) => {
  const { title, message, type } = req.body;
  res.status(201).json({ 
    id: 'notif-' + Date.now(), 
    title, 
    message, 
    type,
    read: false,
    createdAt: new Date().toISOString()
  });
});

app.put('/api/notifications/:id/read', (req, res) => {
  res.json({ 
    id: req.params.id, 
    read: true,
    readAt: new Date().toISOString()
  });
});

const port = process.env.PORT || 3005;
app.listen(port, () => console.log(`notification-service mock on ${port}`));