import { validate } from 'class-validator';
import { SearchLibraryDto } from '../../src/library/dto/request.dto';

describe('SearchLibraryDto', () => {
  it('should pass validation with a valid query', async () => {
    const dto = new SearchLibraryDto();
    dto.query = 'valid-query';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation if query is empty', async () => {
    const dto = new SearchLibraryDto();
    dto.query = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('should fail validation if query is too short', async () => {
    const dto = new SearchLibraryDto();
    dto.query = 'a';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should fail validation if query is not a string', async () => {
    const dto = new SearchLibraryDto();
    (dto as any).query = 123;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should pass validation with optional fields being absent', async () => {
    const dto = new SearchLibraryDto();
    dto.query = 'another-valid-query';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });
});
