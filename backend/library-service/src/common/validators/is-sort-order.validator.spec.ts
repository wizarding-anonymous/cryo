import { validate } from 'class-validator';
import { IsSortOrder } from './is-sort-order.validator';

class TestDto {
  @IsSortOrder()
  order!: string;
}

describe('IsSortOrder Validator', () => {
  it('should pass for "asc"', async () => {
    const dto = new TestDto();
    dto.order = 'asc';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass for "desc"', async () => {
    const dto = new TestDto();
    dto.order = 'desc';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass for "ASC" (case insensitive)', async () => {
    const dto = new TestDto();
    dto.order = 'ASC';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for invalid sort order', async () => {
    const dto = new TestDto();
    dto.order = 'invalid';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('IsSortOrderConstraint');
  });

  it('should fail for non-string value', async () => {
    const dto = new TestDto();
    dto.order = 123 as any;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});