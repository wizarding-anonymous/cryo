import { validate } from 'class-validator';
import { RegisterDto } from './auth/dto/register.dto';
import { LoginDto } from './auth/dto/login.dto';
import { UpdateProfileDto } from './user/dto/update-profile.dto';
import { CreateUserDto } from './user/dto/create-user.dto';

describe('DTO Validation', () => {
  describe('RegisterDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = new RegisterDto();
      dto.name = 'John Doe';
      dto.email = 'john@example.com';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty name', async () => {
      const dto = new RegisterDto();
      dto.name = '';
      dto.email = 'john@example.com';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with invalid email', async () => {
      const dto = new RegisterDto();
      dto.name = 'John Doe';
      dto.email = 'invalid-email';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation with short password', async () => {
      const dto = new RegisterDto();
      dto.name = 'John Doe';
      dto.email = 'john@example.com';
      dto.password = '123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail validation with name too long', async () => {
      const dto = new RegisterDto();
      dto.name = 'a'.repeat(101); // 101 characters
      dto.email = 'john@example.com';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail validation with email too long', async () => {
      const dto = new RegisterDto();
      dto.name = 'John Doe';
      dto.email = 'a'.repeat(250) + '@example.com'; // > 255 characters
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });
  });

  describe('LoginDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = new LoginDto();
      dto.email = 'john@example.com';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty email', async () => {
      const dto = new LoginDto();
      dto.email = '';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with invalid email format', async () => {
      const dto = new LoginDto();
      dto.email = 'not-an-email';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation with empty password', async () => {
      const dto = new LoginDto();
      dto.email = 'john@example.com';
      dto.password = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

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
    it('should pass validation with valid data', async () => {
      const dto = new CreateUserDto();
      dto.name = 'John Doe';
      dto.email = 'john@example.com';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty name', async () => {
      const dto = new CreateUserDto();
      dto.name = '';
      dto.email = 'john@example.com';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with invalid email', async () => {
      const dto = new CreateUserDto();
      dto.name = 'John Doe';
      dto.email = 'invalid-email';
      dto.password = 'strongPassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation with short password', async () => {
      const dto = new CreateUserDto();
      dto.name = 'John Doe';
      dto.email = 'john@example.com';
      dto.password = '123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });
  });
});