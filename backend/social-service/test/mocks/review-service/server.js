const http = require('http');
const url = require('url');

// Mock review storage
const reviews = [];
const reviewRequests = [];

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
    res.end(JSON.stringify({ status: 'ok', service: 'review-service-mock' }));
    return;
  }

  // Validate social connection for review
  if (path === '/v1/reviews/validate-connection' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { reviewerId, targetUserId, connectionType, mutualFriends } = JSON.parse(body);
        
        if (!reviewerId || !targetUserId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_DATA', message: 'reviewerId and targetUserId are required' }));
          return;
        }

        // Mock validation logic
        let canReview = false;
        let credibilityScore = 0;
        let reason = '';

        if (connectionType === 'friends') {
          canReview = true;
          credibilityScore = 80 + Math.min(mutualFriends * 2, 20); // Base 80, +2 per mutual friend, max 100
          reason = 'Users are friends';
        } else if (connectionType === 'pending_request') {
          canReview = false;
          credibilityScore = 20;
          reason = 'Friendship is pending';
        } else {
          canReview = false;
          credibilityScore = 10;
          reason = 'No social connection';
        }

        console.log(`🔍 Review validation: ${reviewerId} -> ${targetUserId}, can review: ${canReview}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          canReview,
          credibilityScore,
          reason,
          connectionType,
          mutualFriends: mutualFriends || 0,
          validatedAt: new Date().toISOString()
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Create review request
  if (path === '/v1/reviews/request' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const reviewRequest = JSON.parse(body);
        
        if (!reviewRequest.reviewerId || !reviewRequest.targetUserId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_DATA', message: 'reviewerId and targetUserId are required' }));
          return;
        }

        const request = {
          id: `review-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...reviewRequest,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        reviewRequests.push(request);
        
        console.log(`📝 Review request created: ${request.id}`);
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(request));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Submit review
  if (path === '/v1/reviews' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const review = JSON.parse(body);
        
        if (!review.reviewerId || !review.targetUserId || !review.rating) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_DATA', message: 'reviewerId, targetUserId, and rating are required' }));
          return;
        }

        const reviewRecord = {
          id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...review,
          status: 'published',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        reviews.push(reviewRecord);
        
        console.log(`⭐ Review submitted: ${reviewRecord.rating}/5 stars from ${review.reviewerId} to ${review.targetUserId}`);
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reviewRecord));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Invalid request body' }));
      }
    });
    return;
  }

  // Get reviews for user
  if (path.startsWith('/v1/users/') && path.endsWith('/reviews') && method === 'GET') {
    const userId = path.split('/')[3];
    
    const userReviews = reviews
      .filter(r => r.targetUserId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50); // Last 50 reviews
    
    const averageRating = userReviews.length > 0 ? 
      userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length : 0;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      userId,
      reviews: userReviews,
      totalReviews: userReviews.length,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution: {
        5: userReviews.filter(r => r.rating === 5).length,
        4: userReviews.filter(r => r.rating === 4).length,
        3: userReviews.filter(r => r.rating === 3).length,
        2: userReviews.filter(r => r.rating === 2).length,
        1: userReviews.filter(r => r.rating === 1).length
      }
    }));
    return;
  }

  // Get review requests for user
  if (path.startsWith('/v1/users/') && path.endsWith('/review-requests') && method === 'GET') {
    const userId = path.split('/')[3];
    
    const userRequests = reviewRequests
      .filter(r => r.targetUserId === userId && r.status === 'pending')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      requests: userRequests,
      total: userRequests.length
    }));
    return;
  }

  // Get all reviews (for testing)
  if (path === '/v1/reviews' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      reviews: reviews.slice(-100), // Last 100 reviews
      total: reviews.length
    }));
    return;
  }

  // Clear reviews (for testing)
  if (path === '/v1/reviews/clear' && method === 'DELETE') {
    reviews.length = 0;
    reviewRequests.length = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'All reviews cleared' }));
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Endpoint not found' }));
});

const PORT = process.env.PORT || 3006;
server.listen(PORT, () => {
  console.log(`Mock Review Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Mock Review Service...');
  server.close(() => {
    process.exit(0);
  });
});