const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'library-service' });
});

app.get('/api/library', (req, res) => {
  res.json({ 
    games: [
      { id: 'game-1', title: 'Cyberpunk 2077', owned: true, installed: true },
      { id: 'game-2', title: 'The Witcher 3', owned: true, installed: false },
      { id: 'game-3', title: 'Metro Exodus', owned: true, installed: true }
    ]
  });
});

app.post('/api/library/:gameId', (req, res) => {
  res.status(201).json({ 
    gameId: req.params.gameId, 
    owned: true, 
    addedAt: new Date().toISOString()
  });
});

app.delete('/api/library/:gameId', (req, res) => {
  res.json({ 
    gameId: req.params.gameId, 
    removed: true 
  });
});

app.get('/api/library/:gameId/download', (req, res) => {
  res.json({ 
    gameId: req.params.gameId, 
    downloadUrl: `https://cdn.example.com/games/${req.params.gameId}/download`,
    size: '50GB'
  });
});

const port = process.env.PORT || 3004;
app.listen(port, () => console.log(`library-service mock on ${port}`));