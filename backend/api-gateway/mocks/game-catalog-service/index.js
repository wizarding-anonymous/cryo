const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'game-catalog-service' });
});

app.get('/api/games', (req, res) => {
  res.json({ 
    games: [
      { 
        id: 'game-1', 
        title: 'Cyberpunk 2077', 
        description: 'Open-world RPG set in Night City',
        price: 59.99,
        genre: 'RPG',
        rating: 4.2,
        releaseDate: '2020-12-10'
      },
      { 
        id: 'game-2', 
        title: 'The Witcher 3: Wild Hunt', 
        description: 'Epic fantasy RPG adventure',
        price: 29.99,
        genre: 'RPG',
        rating: 4.8,
        releaseDate: '2015-05-19'
      },
      { 
        id: 'game-3', 
        title: 'Metro Exodus', 
        description: 'Post-apocalyptic survival shooter',
        price: 39.99,
        genre: 'Action',
        rating: 4.5,
        releaseDate: '2019-02-15'
      }
    ],
    total: 3,
    page: 1,
    limit: 10
  });
});

app.get('/api/games/:id', (req, res) => {
  const games = {
    'game-1': { 
      id: 'game-1', 
      title: 'Cyberpunk 2077', 
      description: 'Open-world RPG set in Night City',
      price: 59.99,
      genre: 'RPG',
      rating: 4.2,
      releaseDate: '2020-12-10',
      systemRequirements: {
        minimum: 'Windows 10, 8GB RAM, GTX 780',
        recommended: 'Windows 10, 16GB RAM, RTX 2060'
      }
    },
    'game-2': { 
      id: 'game-2', 
      title: 'The Witcher 3: Wild Hunt', 
      description: 'Epic fantasy RPG adventure',
      price: 29.99,
      genre: 'RPG',
      rating: 4.8,
      releaseDate: '2015-05-19',
      systemRequirements: {
        minimum: 'Windows 7, 6GB RAM, GTX 660',
        recommended: 'Windows 10, 8GB RAM, GTX 970'
      }
    }
  };
  
  const game = games[req.params.id];
  if (game) {
    res.json(game);
  } else {
    res.status(404).json({ error: 'Game not found' });
  }
});

app.get('/api/games/search', (req, res) => {
  const { q } = req.query;
  res.json({ 
    games: [
      { id: 'game-1', title: 'Cyberpunk 2077', price: 59.99 }
    ],
    query: q,
    total: 1
  });
});

const port = process.env.PORT || 3002;
app.listen(port, () => console.log(`game-catalog-service mock on ${port}`));

