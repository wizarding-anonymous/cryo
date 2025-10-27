# User Service & Redis Deep Analysis

## 1. Current State
- Startup validation now finishes successfully: database is queried on boot and reported healthy (`src/config/startup-validation.service.ts:62`).  
- Nest application reaches the ready state and exposes the API (`src/main.ts:171`).  
- Redis connectivity still fails inside the `user-service` container with `connect ETIMEDOUT`, so the service switches to its fallback logic.

## 2. Service Architecture Highlights
- Configuration is centralised in `AppConfigModule` and `AppConfigService`; Redis settings are pulled from environment variables (`src/config/config.service.ts:64`).  
- Redis connectivity is encapsulated in `RedisService`, which registers event listeners, retries the initial connection, and exposes helper APIs (`src/common/redis/redis.service.ts:20`).  
- Cache-related features (entity cache, TypeORM query cache, metrics) depend on `CacheService` and `TypeOrmQueryCacheService` (`src/common/cache/cache.service.ts:99`, `src/common/cache/typeorm-query-cache.service.ts:66`).  
- Request throttling uses Redis pipelines; failure paths fall back to allowing the request (`src/common/guards/rate-limit.guard.ts:288`).  
- Health endpoints aggregate Redis and cache status but treat them as non-critical (`src/health/health.controller.ts:80`).

## 3. Redis Integration Deep Dive
1. **Connection strategy** – The client is instantiated with aggressive timeouts, disabled offline queue, and manual retry logic (`src/common/redis/redis.service.ts:20`). Three attempts are made with a linear back-off and an extra timeout guard (`src/common/redis/redis.service.ts:69`).  
2. **Fallback behaviour** – If retries exhaust, the service keeps running in "fallback mode" (logging but not throwing) and reports success in module init (`src/common/redis/redis.service.ts:108`).  
3. **Operational guards** – High-level cache helpers short-circuit when Redis is not connected, preventing unhandled promise rejections (`src/common/cache/cache.service.ts:99`). Query cache and rate limiting wrap direct Redis calls in `try/catch`, swallowing failures and returning neutral values (`src/common/cache/typeorm-query-cache.service.ts:83`, `src/common/guards/rate-limit.guard.ts:288`).  
4. **Health monitoring** – Runtime health checks attempt to reconnect if the client is not ready and return `false` instead of throwing (`src/common/redis/redis.service.ts:201`). Health endpoints convert that status into non-critical warnings (`src/health/health.controller.ts:171`).  
5. **Configuration edge case** – `AppConfigService` passes default values as a second argument to `ConfigService.get` (`src/config/config.service.ts:67`). In Nest v10 this argument is treated as `ConfigGetOptions`, so defaults like `'localhost'` or `'6379'` will be ignored if the variable is missing. This does not cause the current failure (the Docker env provides the values) but is worth fixing to avoid surprises in other environments.

**Impact of fallback:** When Redis is unreachable the application serves traffic, but all caching layers, token blacklists, and distributed rate limiting silently degrade to no-ops. Throughput remains stable, at the cost of higher database load and missing throttling guarantees.

## 4. Docker & Networking Findings
- `docker-compose.user-auth.yml` wires both services and dependencies to the same `user-auth-network` (`docker-compose.user-auth.yml:44`).  
- Redis runs as `redis` but is assigned the container name `cryo-redis-cache` (`docker-compose.user-auth.yml:126`). There is no explicit network alias.  
- Environment variables inject `REDIS_HOST=redis` into the user service (`docker-compose.user-auth.yml:65`), yet project documentation instructs setting `REDIS_HOST=redis-cache` (`README.md:232`). This mismatch can leave the container looking for a hostname the network does not advertise, depending on how Docker resolves aliases when `container_name` is present.

**Likely root cause of `ETIMEDOUT`:**
1. **Unresolved hostname alias** – If Docker omitted the `redis` alias because of the custom container name, DNS will resolve `redis` to nothing, causing connection attempts to stall and time out.  
2. **Firewall / Docker Desktop isolation** – Windows hosts occasionally block intra-network traffic between containers. The retry-and-timeout pattern in `RedisService` would present as `connect ETIMEDOUT`.  
3. **Slow password-protected handshake** – With `enableReadyCheck` and `requirepass`, Redis sometimes needs more than 20 seconds to finish the ready check on cold start. After three 25-second races the client gives up and logs fallback mode.

## 5. Verification Checklist
Run the following inside the running stack to validate connectivity:
1. `docker compose -f docker-compose.user-auth.yml exec user-service sh -c "apk add --no-cache busybox-extras && nc -zvw 5 redis 6379"` – confirms DNS and networking.  
2. `docker compose -f docker-compose.user-auth.yml exec user-service getent hosts redis` – inspects the actual hostname mapping.  
3. `docker compose -f docker-compose.user-auth.yml exec user-service node -e "require('ioredis')({ host: 'redis', port: 6379, password: process.env.REDIS_PASSWORD }).ping().then(console.log).catch(console.error)"` – quick runtime probe.  
4. If the hostname fails, repeat with `cryo-redis-cache`. If that works, add `network_mode` aliases or adjust environment variables accordingly.

## 6. Recommendations
1. **Stabilise Docker naming** – Either remove `container_name` overrides or add explicit `network_aliases: [redis, redis-cache]` to the Redis service, then set `REDIS_HOST` to the alias you want to support (`docker-compose.user-auth.yml:126`).  
2. **Align environment defaults** – Replace `configService.get('REDIS_HOST', 'localhost')` with `configService.get('REDIS_HOST', { default: 'localhost' })` (or `getOrThrow`) to ensure non-Docker environments get sane fallbacks (`src/config/config.service.ts:67`).  
3. **Better retry strategy** – Allow more than three attempts and reuse `retryStrategy` from `ioredis` instead of manual `Promise.race`, reducing the chance of premature fallback on slow startups (`src/common/redis/redis.service.ts:69`).  
4. **Expose Redis status in metrics** – Publish a gauge for `redisClient.status` and count fallback operations so it is obvious when the cache is disabled (`src/common/redis/redis.service.ts:39`).  
5. **Fail fast after deployment** – Extend `StartupValidationService` to perform a real Redis `PING` once during boot and surface a clear warning if connectivity is unavailable (`src/config/startup-validation.service.ts:82`).  
6. **Optional guardrails** – Add `redisService.isConnected()` checks before expensive operations in the TypeORM cache to avoid repeated connection attempts when the cache is down (`src/common/cache/typeorm-query-cache.service.ts:83`).

## 7. Next Steps
1. Validate connectivity inside the running containers (Checklist §5).  
2. Fix hostname/alias mismatch if confirmed.  
3. Roll out the retry and config improvements.  
4. Monitor cache hit metrics and database load once Redis is reachable.

Once the above actions are complete, re-run the stack and confirm that Redis logs "Redis connection established successfully" instead of "Running in fallback mode" (`src/common/redis/redis.service.ts:99`).
