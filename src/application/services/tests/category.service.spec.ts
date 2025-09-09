import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CategoryService } from '../category.service';
import { CategoryRepository } from '../../../infrastructure/persistence/category.repository';
import { CreateCategoryDto } from '../../../infrastructure/http/dtos/create-category.dto';
import { Category } from '../../../domain/entities/category.entity';

// Mock the repository and other dependencies
const mockCategoryRepository = {
  create: jest.fn(),
  findBySlug: jest.fn(),
};

const mockCacheManager = {
  store: {
    keys: jest.fn(),
    del: jest.fn(),
  },
};

describe('CategoryService', () => {
  let service: CategoryService;
  let repository: typeof mockCategoryRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: CategoryRepository,
          useValue: mockCategoryRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    repository = module.get(CategoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category with a unique slug', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'New Category',
        description: 'A new category for testing',
      };

      const expectedSlug = 'new-category';
      const createdCategory = new Category();
      Object.assign(createdCategory, createCategoryDto, { slug: expectedSlug, id: 'some-uuid' });

      // Mock the repository methods
      repository.findBySlug.mockResolvedValue(null); // Slug is unique
      repository.create.mockResolvedValue(createdCategory);
      mockCacheManager.store.keys.mockResolvedValue([]);

      const result = await service.create(createCategoryDto);

      // Verify the slug was generated and checked
      expect(repository.findBySlug).toHaveBeenCalledWith(expectedSlug);
      // Verify the category was created with the correct data
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Category',
        slug: expectedSlug,
      }));
      // Verify cache was invalidated
      expect(mockCacheManager.store.keys).toHaveBeenCalled();

      expect(result).toEqual(createdCategory);
    });

    it('should generate a unique slug if the initial one is taken', async () => {
      const createCategoryDto: CreateCategoryDto = { name: 'Existing Category' };
      const initialSlug = 'existing-category';
      const finalSlug = 'existing-category-1';

      const createdCategory = new Category();
      Object.assign(createdCategory, createCategoryDto, { slug: finalSlug, id: 'some-uuid' });

      // Mock the repository methods
      repository.findBySlug
        .mockResolvedValueOnce({ id: 'another-uuid', name: 'Existing Category' }) // First slug is taken
        .mockResolvedValueOnce(null); // Second slug is available
      repository.create.mockResolvedValue(createdCategory);
      mockCacheManager.store.keys.mockResolvedValue([]);

      const result = await service.create(createCategoryDto);

      // Verify the slug was checked twice
      expect(repository.findBySlug).toHaveBeenCalledTimes(2);
      expect(repository.findBySlug).toHaveBeenCalledWith(initialSlug);
      expect(repository.findBySlug).toHaveBeenCalledWith(finalSlug);

      // Verify the category was created with the final slug
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        slug: finalSlug,
      }));

      expect(result).toEqual(createdCategory);
    });
  });
});
