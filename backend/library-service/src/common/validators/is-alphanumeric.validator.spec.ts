import { validate } from 'class-validator';
import { IsAlphanumeric } from './is-alphanumeric.validator';

class TestDto {
  @IsAlphanumeric()
  value!: string;
}

describe('IsAlphanumeric Validator', () => {
  it('should pass for alphanumeric string', async () => {
    const dto = new TestDto();
    dto.value = 'abc123';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass for letters only', async () => {
    const dto = new TestDto();
    dto.value = 'abcDEF';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass for numbers only', async () => {
    const dto = new TestDto();
    dto.value = '123456';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for string with spaces', async () => {
    const dto = new TestDto();
    dto.value = 'abc 123';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('IsAlphanumericConstraint');
  });

  it('should fail for string with special characters', async () => {
    const dto = new TestDto();
    dto.value = 'abc-123';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('should fail for non-string value', async () => {
    const dto = new TestDto();
    dto.value = 123 as any;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('should fail for empty string', async () => {
    const dto = new TestDto();
    dto.value = '';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});