import { validate } from 'class-validator';
import { IsPositiveNumber } from './is-positive-number.validator';

class TestDto {
  @IsPositiveNumber()
  value!: number;
}

describe('IsPositiveNumber Validator', () => {
  it('should pass for positive number', async () => {
    const dto = new TestDto();
    dto.value = 42;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass for positive decimal', async () => {
    const dto = new TestDto();
    dto.value = 3.14;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass for string number', async () => {
    const dto = new TestDto();
    dto.value = '123' as any;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for zero', async () => {
    const dto = new TestDto();
    dto.value = 0;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('IsPositiveNumberConstraint');
  });

  it('should fail for negative number', async () => {
    const dto = new TestDto();
    dto.value = -5;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('should fail for NaN', async () => {
    const dto = new TestDto();
    dto.value = NaN;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('should fail for Infinity', async () => {
    const dto = new TestDto();
    dto.value = Infinity;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
