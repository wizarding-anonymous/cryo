const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/games', (req, res) => {
  res.json({ items: [{ id: 1, title: 'Mock Game' }] });
});

const port = process.env.PORT || 3002;
app.listen(port, () => console.log(`game-catalog mock on ${port}`));

