import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleService } from './role.service';
import { Role } from '../../domain/entities/role.entity';
import { UserRole } from '../../domain/entities/user-role.entity';

describe('RoleService', () => {
  let service: RoleService;
  let roleRepository: Repository<Role>;
  let userRoleRepository: Repository<UserRole>;

  const mockRoleRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockUserRoleRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    userRoleRepository = module.get<Repository<UserRole>>(getRepositoryToken(UserRole));
  });

  it('should create a role', async () => {
    const roleData = { name: 'test', description: 'a test role', permissions: ['test:permission'] };
    mockRoleRepo.create.mockReturnValue(roleData);
    mockRoleRepo.save.mockResolvedValue({ id: 'role-id', ...roleData });

    const result = await service.createRole(roleData.name, roleData.description, roleData.permissions);

    expect(mockRoleRepo.create).toHaveBeenCalledWith(roleData);
    expect(mockRoleRepo.save).toHaveBeenCalledWith(roleData);
    expect(result.id).toBe('role-id');
  });

  it('should get user permissions', async () => {
    const userId = 'user-id';
    const assignments = [
      { userId, role: { permissions: ['perm1', 'perm2'] } },
      { userId, role: { permissions: ['perm2', 'perm3'] } },
    ];
    (mockUserRoleRepo.find as jest.Mock).mockResolvedValue(assignments);

    const permissions = await service.getUserPermissions(userId);

    expect(permissions).toHaveLength(3);
    expect(permissions).toContain('perm1');
    expect(permissions).toContain('perm2');
    expect(permissions).toContain('perm3');
  });
});
