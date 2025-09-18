# Social Service DTOs

This directory contains all Data Transfer Objects (DTOs) for the Social Service MVP.

## Structure

### Common DTOs (`/common/dto/`)
- `ErrorResponseDto` - Standard error response format
- `PaginationDto` - Pagination information for lists
- `SuccessResponseDto` - Standard success response format
- `UuidParamDto` - UUID parameter validation

### Friends DTOs (`/friends/dto/`)
- `AcceptFriendRequestDto` - Accept friend request payload
- `BulkFriendActionDto` - Bulk operations on friends
- `DeclineFriendRequestDto` - Decline friend request payload
- `FriendDto` - Friend information response
- `FriendsQueryDto` - Query parameters for friends list
- `FriendsResponseDto` - Paginated friends list response
- `FriendsStatsDto` - Friends statistics
- `SearchUsersQueryDto` - User search query parameters
- `SendFriendRequestDto` - Send friend request payload
- `UserSearchResultDto` - User search result item

### Messages DTOs (`/messages/dto/`)
- `BulkMarkReadDto` - Bulk mark messages as read
- `ConversationDto` - Conversation information
- `ConversationResponseDto` - Paginated conversation messages
- `MarkAsReadDto` - Mark single message as read
- `MessageDto` - Message information
- `MessagesQueryDto` - Query parameters for messages
- `SendMessageDto` - Send message payload
- `UnreadCountDto` - Unread messages count

### Status DTOs (`/status/dto/`)
- `FriendStatusDto` - Friend online status information
- `SetStatusDto` - Set user status payload

## Validation Features

All DTOs include:
- **Class-validator decorators** for input validation
- **Swagger/OpenAPI decorators** for API documentation
- **Type safety** with TypeScript
- **Proper error messages** for validation failures

## Custom Validators

- `IsNotSameUser` - Ensures two user IDs are not the same (prevents self-actions)

## Usage

```typescript
import { SendFriendRequestDto, FriendsResponseDto } from '../dto';

// In controllers
@Post('request')
async sendFriendRequest(@Body() dto: SendFriendRequestDto): Promise<FriendDto> {
  // Implementation
}

@Get()
async getFriends(@Query() query: FriendsQueryDto): Promise<FriendsResponseDto> {
  // Implementation
}
```

## Validation Examples

### Friend Request Validation
```typescript
{
  "toUserId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // Required UUID
  "message": "Hey, let's be friends!" // Optional, max 200 chars
}
```

### Message Validation
```typescript
{
  "toUserId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // Required UUID
  "content": "Hello there!" // Required, 1-1000 chars
}
```

### Query Validation
```typescript
{
  "page": 1,        // Optional, min 1
  "limit": 20,      // Optional, min 1, max 50
  "status": "all"   // Optional, enum: online|offline|all
}
```

All DTOs are designed according to the Social Service MVP requirements and follow NestJS best practices.