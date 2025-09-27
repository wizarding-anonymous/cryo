import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 100 }, // Ramp up to 100 users
        { duration: '5m', target: 500 }, // Ramp up to 500 users
        { duration: '10m', target: 1000 }, // Ramp up to 1000 users
        { duration: '10m', target: 1000 }, // Stay at 1000 users
        { duration: '5m', target: 500 }, // Ramp down to 500 users
        { duration: '2m', target: 0 }, // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
        http_req_failed: ['rate<0.1'], // Error rate must be below 10%
        errors: ['rate<0.1'], // Custom error rate must be below 10%
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3004';

// Mock JWT token for testing (replace with actual token generation)
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzQ1NjcwMDB9.test';

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JWT_TOKEN}`,
};

// Test data generators
function generateUserId() {
    return `user-${Math.floor(Math.random() * 10000)}`;
}

function generateGameId() {
    return `game-${Math.floor(Math.random() * 1000)}`;
}

function generateReview() {
    const reviews = [
        'Great game with excellent graphics and gameplay!',
        'Amazing storyline and character development.',
        'Fun multiplayer experience with friends.',
        'Challenging but rewarding gameplay mechanics.',
        'Beautiful art style and immersive world.',
        'Solid gameplay with minor bugs that need fixing.',
        'Good game but could use more content updates.',
        'Decent game but not worth the full price.',
        'Disappointing compared to previous versions.',
        'Terrible optimization and frequent crashes.',
    ];
    return reviews[Math.floor(Math.random() * reviews.length)];
}

function generateRating() {
    return Math.floor(Math.random() * 5) + 1;
}

export default function () {
    const userId = generateUserId();
    const gameId = generateGameId();

    // Test scenarios with different weights
    const scenario = Math.random();

    if (scenario < 0.4) {
        // 40% - Create review
        testCreateReview(userId, gameId);
    } else if (scenario < 0.7) {
        // 30% - Get game reviews
        testGetGameReviews(gameId);
    } else if (scenario < 0.9) {
        // 20% - Get game rating
        testGetGameRating(gameId);
    } else {
        // 10% - Health check
        testHealthCheck();
    }

    sleep(1);
}

function testCreateReview(userId, gameId) {
    const payload = JSON.stringify({
        gameId: gameId,
        text: generateReview(),
        rating: generateRating(),
    });

    const response = http.post(`${BASE_URL}/reviews`, payload, { headers });

    const success = check(response, {
        'create review status is 201 or 409': (r) => r.status === 201 || r.status === 409, // 409 for duplicate
        'create review response time < 200ms': (r) => r.timings.duration < 200,
    });

    errorRate.add(!success);
}

function testGetGameReviews(gameId) {
    const response = http.get(`${BASE_URL}/reviews/game/${gameId}?page=1&limit=10`);

    const success = check(response, {
        'get reviews status is 200': (r) => r.status === 200,
        'get reviews response time < 200ms': (r) => r.timings.duration < 200,
        'get reviews has data': (r) => {
            try {
                const data = JSON.parse(r.body);
                return data.hasOwnProperty('reviews') && Array.isArray(data.reviews);
            } catch {
                return false;
            }
        },
    });

    errorRate.add(!success);
}

function testGetGameRating(gameId) {
    const response = http.get(`${BASE_URL}/ratings/game/${gameId}`);

    const success = check(response, {
        'get rating status is 200': (r) => r.status === 200,
        'get rating response time < 200ms': (r) => r.timings.duration < 200,
        'get rating has data': (r) => {
            try {
                const data = JSON.parse(r.body);
                return data.hasOwnProperty('averageRating') || data.hasOwnProperty('message');
            } catch {
                return false;
            }
        },
    });

    errorRate.add(!success);
}

function testHealthCheck() {
    const response = http.get(`${BASE_URL}/health`);

    const success = check(response, {
        'health check status is 200': (r) => r.status === 200,
        'health check response time < 100ms': (r) => r.timings.duration < 100,
        'health check has status': (r) => {
            try {
                const data = JSON.parse(r.body);
                return data.status === 'healthy';
            } catch {
                return false;
            }
        },
    });

    errorRate.add(!success);
}

// Setup function to run before the test
export function setup() {
    console.log('Starting load test for Review Service');
    console.log(`Target URL: ${BASE_URL}`);

    // Verify service is running
    const response = http.get(`${BASE_URL}/health`);
    if (response.status !== 200) {
        throw new Error(`Service is not healthy. Status: ${response.status}`);
    }

    console.log('Service health check passed. Starting load test...');
}

// Teardown function to run after the test
export function teardown() {
    console.log('Load test completed');
}