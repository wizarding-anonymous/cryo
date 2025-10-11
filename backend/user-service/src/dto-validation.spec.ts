import { validate } from 'class-validator';
import { UpdateProfileDto } from './user/dto/update-profile.dto';
import { CreateUserDto } from './user/dto/create-user.dto';

describe('DTO Validation', () => {

  describe('UpdateProfileDto', () => {
    it('should pass validation with valid name', async () => {
      const dto = new UpdateProfileDto();
      dto.name = 'John Doe Updated';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with no fields (all optional)', async () => {
      const dto = new UpdateProfileDto();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty name when provided', async () => {
      const dto = new UpdateProfileDto();
      dto.name = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with name too long', async () => {
      const dto = new UpdateProfileDto();
      dto.name = 'a'.repeat(101); // 101 characters

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });
  });

  describe('CreateUserDto', () => {
    it('should pass validation with valid data (pre-hashed password)', async () => {
      const dto = new CreateUserDto();
      dto.name = 'John Doe';
      dto.email = 'john@example.com';
      dto.password = '$2b$10$hashedPasswordFromAuthService'; // Pre-hashed password

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty name', async () => {
      const dto = new CreateUserDto();
      dto.name = '';
      dto.email = 'john@example.com';
      dto.password = '$2b$10$hashedPasswordFromAuthService';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with invalid email', async () => {
      const dto = new CreateUserDto();
      dto.name = 'John Doe';
      dto.email = 'invalid-email';
      dto.password = '$2b$10$hashedPasswordFromAuthService';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation with empty password', async () => {
      const dto = new CreateUserDto();
      dto.name = 'John Doe';
      dto.email = 'john@example.com';
      dto.password = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });
});
