import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

// Friends DTOs
import { SendFriendRequestDto } from './friends/dto/send-friend-request.dto';
import { FriendsQueryDto } from './friends/dto/friends-query.dto';
import { SearchUsersQueryDto } from './friends/dto/search-users-query.dto';

// Messages DTOs
import { SendMessageDto } from './messages/dto/send-message.dto';
import { MessagesQueryDto } from './messages/dto/messages-query.dto';

// Status DTOs
import { SetStatusDto } from './status/dto/set-status.dto';

describe('DTO Validation', () => {
  describe('SendFriendRequestDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(SendFriendRequestDto, {
        toUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        message: "Hey, let's be friends!",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate without optional message', async () => {
      const dto = plainToClass(SendFriendRequestDto, {
        toUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid UUID', async () => {
      const dto = plainToClass(SendFriendRequestDto, {
        toUserId: 'invalid-uuid',
        message: "Hey, let's be friends!",
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('isUuid');
    });

    it('should fail validation with empty toUserId', async () => {
      const dto = plainToClass(SendFriendRequestDto, {
        toUserId: '',
        message: "Hey, let's be friends!",
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with message too long', async () => {
      const dto = plainToClass(SendFriendRequestDto, {
        toUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        message: 'a'.repeat(201), // 201 characters, max is 200
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('maxLength');
    });
  });

  describe('SendMessageDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(SendMessageDto, {
        toUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        content: 'Hello! How are you?',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid UUID', async () => {
      const dto = plainToClass(SendMessageDto, {
        toUserId: 'invalid-uuid',
        content: 'Hello! How are you?',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('isUuid');
    });

    it('should fail validation with empty content', async () => {
      const dto = plainToClass(SendMessageDto, {
        toUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        content: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with content too long', async () => {
      const dto = plainToClass(SendMessageDto, {
        toUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        content: 'a'.repeat(1001), // 1001 characters, max is 1000
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('maxLength');
    });
  });

  describe('FriendsQueryDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(FriendsQueryDto, {
        page: '1',
        limit: '20',
        status: 'online',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with default values', async () => {
      const dto = plainToClass(FriendsQueryDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.status).toBe('all');
    });

    it('should fail validation with invalid page number', async () => {
      const dto = plainToClass(FriendsQueryDto, {
        page: '0',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('min');
    });

    it('should fail validation with limit too high', async () => {
      const dto = plainToClass(FriendsQueryDto, {
        limit: '51',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('max');
    });

    it('should fail validation with invalid status', async () => {
      const dto = plainToClass(FriendsQueryDto, {
        status: 'invalid-status',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('MessagesQueryDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(MessagesQueryDto, {
        page: '1',
        limit: '50',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with default values', async () => {
      const dto = plainToClass(MessagesQueryDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(50);
    });

    it('should fail validation with invalid page number', async () => {
      const dto = plainToClass(MessagesQueryDto, {
        page: '0',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('min');
    });

    it('should fail validation with limit too high', async () => {
      const dto = plainToClass(MessagesQueryDto, {
        limit: '101',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('max');
    });
  });

  describe('SearchUsersQueryDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(SearchUsersQueryDto, {
        q: 'john',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty query', async () => {
      const dto = plainToClass(SearchUsersQueryDto, {
        q: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with query too short', async () => {
      const dto = plainToClass(SearchUsersQueryDto, {
        q: 'a',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('minLength');
    });

    it('should fail validation with query too long', async () => {
      const dto = plainToClass(SearchUsersQueryDto, {
        q: 'a'.repeat(51), // 51 characters, max is 50
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('maxLength');
    });
  });

  describe('SetStatusDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToClass(SetStatusDto, {
        currentGame: 'Cyberpunk 2077',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate without optional currentGame', async () => {
      const dto = plainToClass(SetStatusDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with currentGame too long', async () => {
      const dto = plainToClass(SetStatusDto, {
        currentGame: 'a'.repeat(101), // 101 characters, max is 100
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('maxLength');
    });
  });
});
