# Profile Service

The Profile Service handles all user profile management operations in the User Service microservice.

## Features

### Core Profile Management
- **Get Profile**: Retrieve user profile information without sensitive data
- **Update Profile**: Update user profile with validation and cache invalidation
- **Delete Profile**: Soft delete user profile with cleanup

### Avatar Management
- **Upload Avatar**: Handle file uploads with validation (max 5MB, image formats only)
- **Delete Avatar**: Remove avatar files from filesystem and database
- **File Validation**: Automatic validation of file type, size, and format

### Preferences Management
- **Get/Update Preferences**: Manage user preferences (language, theme, notifications, game settings)
- **Merge Strategy**: Intelligent merging of existing and new preferences

### Privacy Settings Management
- **Get/Update Privacy Settings**: Control profile visibility and privacy options
- **Granular Control**: Fine-grained privacy controls for different aspects

## API Endpoints

### Profile Operations
```
GET    /api/profiles/:userId              - Get user profile
PATCH  /api/profiles/:userId              - Update user profile
DELETE /api/profiles/:userId              - Delete user profile
```

### Avatar Operations
```
POST   /api/profiles/:userId/avatar       - Upload avatar (multipart/form-data)
DELETE /api/profiles/:userId/avatar       - Delete avatar
```

### Preferences Operations
```
GET    /api/profiles/:userId/preferences  - Get user preferences
PATCH  /api/profiles/:userId/preferences  - Update preferences
```

### Privacy Settings Operations
```
GET    /api/profiles/:userId/privacy-settings    - Get privacy settings
PATCH  /api/profiles/:userId/privacy-settings    - Update privacy settings
```

## File Upload Configuration

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)

### Validation Rules
- Maximum file size: 5MB
- MIME type validation
- File extension validation
- Automatic filename generation with timestamp

### Storage
- Local filesystem storage in `uploads/avatars/`
- Filename format: `{userId}-{timestamp}.{ext}`
- Automatic cleanup on avatar deletion

## Caching Strategy

### Cache Integration
- Automatic cache invalidation on profile updates
- Cache-aside pattern for profile data
- Separate caching for user and profile data

### Cache Keys
- User cache: `user-service:user:{userId}`
- Profile cache: `user-service:profile:{userId}`

## Error Handling

### Standard Errors
- `NotFoundException`: User or profile not found
- `BadRequestException`: Invalid data or missing files
- `ConflictException`: Data conflicts or validation errors

### File Upload Errors
- Invalid file format
- File too large
- Missing file in request
- Filesystem errors (logged, not thrown)

## Security Features

### Input Validation
- UUID validation for user IDs
- File type and size validation
- Data sanitization and validation

### Rate Limiting
- Avatar upload: 5 uploads per minute
- Profile updates: 10 updates per minute
- Applied per IP address

### Access Control
- Internal service authentication
- Request throttling
- CORS protection

## Performance Optimizations

### Caching
- Redis-based caching with TTL
- Automatic cache invalidation
- Batch cache operations

### File Handling
- Efficient file storage
- Automatic cleanup
- Error resilience

### Database Operations
- Optimized queries
- Batch operations support
- Connection pooling

## Monitoring and Logging

### Metrics
- Operation success/failure rates
- Response times
- Cache hit/miss ratios
- File upload statistics

### Logging
- Structured logging with correlation IDs
- Security event logging
- Error tracking with stack traces
- Performance monitoring

## Usage Examples

### Basic Profile Update
```typescript
const profileData = {
  name: 'John Doe',
  preferences: {
    language: 'en',
    theme: 'dark'
  }
};

const updatedProfile = await profileService.updateProfile(userId, profileData);
```

### Avatar Upload
```typescript
const file = request.file; // From multer
const result = await profileService.uploadAvatar(userId, file);
// Returns: { avatarUrl: '/uploads/avatars/user-123.jpg', message: 'Success' }
```

### Preferences Update
```typescript
const preferences = {
  notifications: {
    email: false,
    push: true
  },
  gameSettings: {
    autoDownload: true
  }
};

const updated = await profileService.updatePreferences(userId, preferences);
```

## Testing

### Unit Tests
- Complete test coverage for all methods
- Mock dependencies (UserService, CacheService)
- Error scenario testing
- Edge case validation

### Integration Tests
- End-to-end API testing
- File upload testing
- Database integration
- Cache integration

### Performance Tests
- Load testing for file uploads
- Concurrent operation testing
- Memory usage validation
- Response time benchmarks