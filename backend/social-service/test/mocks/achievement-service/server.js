const http = require('http');
const url = require('url');

// Mock achievement storage
const userAchievements = new Map();
const achievementProgress = new Map();

// Achievement definitions
const achievements = {
  'first-friend': {
    id: 'first-friend',
    name: 'Первый друг',
    description: 'Добавьте своего первого друга',
    type: 'social',
    points: 10,
    requirements: { friends: 1 }
  },
  'social-butterfly': {
    id: 'social-butterfly',
    name: 'Социальная бабочка',
    description: 'Добавьте 10 друзей',
    type: 'social',
    points: 50,
    requirements: { friends: 10 }
  },
  'popular-player': {
    id: 'popular-player',
    name: 'Популярный игрок',
    description: 'Добавьте 50 друзей',
    type: 'social',
    points: 200,
    requirements: { friends: 50 }
  }
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
    res.end(JSON.stringify({ status: 'ok', service: 'achievement-service-mock' }));
    return;
  }

  // Update social progress
  if (path === '/v1/achievements/social/progress' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { userId, friendsCount } = JSON.parse(body);
        
        if (!userId || typeof friendsCount !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_DATA', message: 'userId and friendsCount are required' }));
          return;
        }

        // Update progress
        achievementProgress.set(userId, { friendsCount, updatedAt: new Date().toISOString() });
        
        // Check for new achievements
        const newAchievements = [];
        const userAchievementsList = userAchievements.get(userId) || [];
        
        Object.values(achievements).forEach(achievement => {
          const hasAchievement = userAchievementsList.some(a => a.id === achievement.id);
          
          if (!hasAchievement && friendsCount >= achievement.requirements.friends) {
            const newAchievement = {
              ...achievement,
              unlockedAt: new Date().toISOString(),
              progress: 100
            };
            
            userAchievementsList.push(newAchievement);
            newAchievements.push(newAchievement);
            
            console.log(`🏆 Achievement unlocked: ${achievement.name} for user ${userId}`);
          }
        });
        
        userAchievements.set(userId, userAchievementsList);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          newAchievements,
          totalAchievements: userAchievementsList.length,
          message: newAchievements.length > 0 ? 
            `${newAchievements.length} new achievements unlocked!` : 
            'Progress updated'
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // First friend webhook
  if (path === '/v1/achievements/webhooks/first-friend' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { userId, friendId, timestamp } = JSON.parse(body);
        
        if (!userId || !friendId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_DATA', message: 'userId and friendId are required' }));
          return;
        }

        const userAchievementsList = userAchievements.get(userId) || [];
        const hasFirstFriendAchievement = userAchievementsList.some(a => a.id === 'first-friend');
        
        if (!hasFirstFriendAchievement) {
          const firstFriendAchievement = {
            ...achievements['first-friend'],
            unlockedAt: timestamp || new Date().toISOString(),
            progress: 100,
            metadata: { firstFriendId: friendId }
          };
          
          userAchievementsList.push(firstFriendAchievement);
          userAchievements.set(userId, userAchievementsList);
          
          console.log(`🏆 First Friend achievement unlocked for user ${userId}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            achievement: firstFriendAchievement,
            message: 'First Friend achievement unlocked!'
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Achievement already unlocked'
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Get user achievements
  if (path.startsWith('/v1/users/') && path.endsWith('/achievements') && method === 'GET') {
    const userId = path.split('/')[3];
    
    const userAchievementsList = userAchievements.get(userId) || [];
    const progress = achievementProgress.get(userId) || { friendsCount: 0 };
    
    // Calculate progress for locked achievements
    const allAchievements = Object.values(achievements).map(achievement => {
      const unlocked = userAchievementsList.find(a => a.id === achievement.id);
      
      if (unlocked) {
        return unlocked;
      } else {
        const currentProgress = Math.min(
          (progress.friendsCount / achievement.requirements.friends) * 100,
          100
        );
        
        return {
          ...achievement,
          progress: currentProgress,
          unlocked: false
        };
      }
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      userId,
      achievements: allAchievements,
      unlockedCount: userAchievementsList.length,
      totalCount: Object.keys(achievements).length,
      totalPoints: userAchievementsList.reduce((sum, a) => sum + a.points, 0)
    }));
    return;
  }

  // Get achievement leaderboard
  if (path === '/v1/achievements/leaderboard' && method === 'GET') {
    const leaderboard = Array.from(userAchievements.entries())
      .map(([userId, achievements]) => ({
        userId,
        achievementCount: achievements.length,
        totalPoints: achievements.reduce((sum, a) => sum + a.points, 0),
        lastUnlocked: achievements.length > 0 ? 
          Math.max(...achievements.map(a => new Date(a.unlockedAt).getTime())) : 0
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.achievementCount - a.achievementCount)
      .slice(0, 100); // Top 100
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      leaderboard,
      total: leaderboard.length
    }));
    return;
  }

  // Get all achievements definitions
  if (path === '/v1/achievements' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      achievements: Object.values(achievements)
    }));
    return;
  }

  // Clear achievements (for testing)
  if (path === '/v1/achievements/clear' && method === 'DELETE') {
    userAchievements.clear();
    achievementProgress.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'All achievements cleared' }));
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Endpoint not found' }));
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Mock Achievement Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Mock Achievement Service...');
  server.close(() => {
    process.exit(0);
  });
});