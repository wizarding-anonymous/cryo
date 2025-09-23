import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 200 },   // ramp-up
    { duration: '1m', target: 500 },    // ramp further
    { duration: '1m', target: 1000 },   // peak load
    { duration: '2m', target: 1000 },   // sustain
    { duration: '30s', target: 0 },     // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // 95% under 200ms as per spec
    http_req_failed: ['rate<0.01'],     // <1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const REQUIRE_AUTH = (String(__ENV.REQUIRE_AUTH || 'true').toLowerCase() === 'true');
const COMMON_HEADERS = JWT_TOKEN
  ? { Authorization: `Bearer ${JWT_TOKEN}` }
  : {};

export default function () {
  // --- GET /library/my ---
  const libraryRes = http.get(`${BASE_URL}/library/my`, { headers: COMMON_HEADERS });
  check(libraryRes, {
    'GET /library/my ok': (r) => (REQUIRE_AUTH ? r.status === 200 : r.status === 200 || r.status === 401),
  });

  sleep(0.5);

  // --- GET /library/my/search ---
  const queries = ['test', 'action', 'dev', 'open', 'rpg'];
  const q = queries[Math.floor(Math.random() * queries.length)];
  const searchRes = http.get(`${BASE_URL}/library/my/search?query=${encodeURIComponent(q)}`, { headers: COMMON_HEADERS });
  check(searchRes, {
    'GET /library/my/search ok': (r) => (REQUIRE_AUTH ? r.status === 200 : r.status === 200 || r.status === 401),
  });

  sleep(0.5);

  // --- GET /library/ownership/:gameId ---
  const gameId = '00000000-0000-0000-0000-000000000001';
  const ownershipRes = http.get(`${BASE_URL}/library/ownership/${gameId}`, { headers: COMMON_HEADERS });
  check(ownershipRes, {
    'GET /library/ownership/:gameId ok': (r) => (REQUIRE_AUTH ? r.status === 200 : r.status === 200 || r.status === 401),
  });

  sleep(0.5);
}
