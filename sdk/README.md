# User Service SDK

SDK for integrating with the User Service of the Russian gaming platform.

## Installation

```bash
npm install @gaming-platform/user-service-sdk
```

## Quick Start

```typescript
import { UserServiceClient } from '@gaming-platform/user-service-sdk';

const client = new UserServiceClient({
  baseUrl: 'https://api.gaming-platform.ru',
  // In a real scenario, this would use a secure authentication method
  // like an API key or an OAuth token.
  authToken: 'your-auth-token'
});

// Example: Get a basic developer profile
const profile = await client.developers.getBasicProfile('user-id-123');
console.log(profile);
```

## Features

- ✅ Get basic developer profiles
- ✅ Get basic publisher profiles
- ✅ Check verification status
- ✅ TypeScript typings
- ✅ Automatic authentication handling
- ✅ Error handling and retry logic

## Documentation

- [API Reference](docs/api-reference.md)
- [Usage Examples](docs/examples.md)
- [Authentication](docs/authentication.md)
