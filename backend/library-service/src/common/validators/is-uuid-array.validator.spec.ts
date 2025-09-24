import { validate } from 'class-validator';
import { IsUuidArray } from './is-uuid-array.validator';

class TestDto {
  @IsUuidArray()
  uuids!: string[];
}

describe('IsUuidArray Validator', () => {
  it('should pass for valid UUID array', async () => {
    const dto = new TestDto();
    dto.uuids = [
      '123e4567-e89b-12d3-a456-426614174000',
      '987fcdeb-51a2-43d1-9f12-345678901234',
    ];

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for invalid UUID in array', async () => {
    const dto = new TestDto();
    dto.uuids = ['123e4567-e89b-12d3-a456-426614174000', 'invalid-uuid'];

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('IsUuidArrayConstraint');
  });

  it('should fail for non-array value', async () => {
    const dto = new TestDto();
    dto.uuids = 'not-an-array' as any;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('should pass for empty array', async () => {
    const dto = new TestDto();
    dto.uuids = [];

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
