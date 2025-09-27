const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

app.get('/api/payments', (req, res) => {
  res.json({ 
    payments: [
      { id: 'pay-1', amount: 59.99, status: 'completed', gameId: 'game-1' },
      { id: 'pay-2', amount: 29.99, status: 'pending', gameId: 'game-2' }
    ]
  });
});

app.post('/api/payments', (req, res) => {
  const { amount, gameId } = req.body;
  res.status(201).json({ 
    id: 'pay-' + Date.now(), 
    amount, 
    gameId, 
    status: 'pending',
    createdAt: new Date().toISOString()
  });
});

app.get('/api/payments/:id', (req, res) => {
  res.json({ 
    id: req.params.id, 
    amount: 59.99, 
    status: 'completed', 
    gameId: 'game-1',
    createdAt: '2024-01-01T00:00:00Z'
  });
});

const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`payment-service mock on ${port}`));