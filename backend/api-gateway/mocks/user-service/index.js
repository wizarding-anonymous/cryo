const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/profile', (req, res) => {
  res.json({ id: 'mock-user-id', email: 'mock@example.com', roles: [], permissions: [] });
});

app.post('/api/users/profile', (req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`user-service mock on ${port}`));

