import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateService } from '../corporate.service';
import { CorporateProfile } from '../../../domain/entities/corporate-profile.entity';
import { User } from '../../../domain/entities/user.entity';
import { EventPublisher } from '../../events/event-publisher.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CorporateService', () => {
  let service: CorporateService;
  let corporateProfileRepository: jest.Mocked<Repository<CorporateProfile>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let eventPublisher: jest.Mocked<EventPublisher>;

  const mockUser: User = {
    id: 'admin-123',
    email: 'admin@company.com',
    username: 'admin',
    isActive: true,
    isBlocked: false,
  } as User;

  const mockCompanyData = {
    companyName: 'Test Company',
    inn: '1234567890',
    ogrn: '1234567890123',
    legalAddress: 'Test Address',
    industry: 'IT',
    companySize: 'medium' as const,
    website: 'https://test.com',
    headquarters: 'Moscow',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorporateService,
        {
          provide: getRepositoryToken(CorporateProfile),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: EventPublisher,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CorporateService>(CorporateService);
    corporateProfileRepository = module.get(getRepositoryToken(CorporateProfile));
    userRepository = module.get(getRepositoryToken(User));
    eventPublisher = module.get(EventPublisher);
  });

  describe('createCorporateProfile', () => {
    it('should create a corporate profile successfully', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      corporateProfileRepository.findOneBy.mockResolvedValue(null);

      const mockProfile = {
        id: 'corp-123',
        adminUserId: mockUser.id,
        companyInfo: {
          name: mockCompanyData.companyName,
          inn: mockCompanyData.inn,
        },
      } as CorporateProfile;

      corporateProfileRepository.create.mockReturnValue(mockProfile);
      corporateProfileRepository.save.mockResolvedValue(mockProfile);

      // Act
      const result = await service.createCorporateProfile(mockUser.id, mockCompanyData);

      // Assert
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: mockUser.id });
      expect(corporateProfileRepository.findOneBy).toHaveBeenCalledWith({ adminUserId: mockUser.id });
      expect(corporateProfileRepository.create).toHaveBeenCalled();
      expect(corporateProfileRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith('corporate.profile.created', expect.any(Object));
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException when admin user does not exist', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createCorporateProfile('non-existent', mockCompanyData)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when corporate profile already exists', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      corporateProfileRepository.findOneBy.mockResolvedValue({} as CorporateProfile);

      // Act & Assert
      await expect(service.createCorporateProfile(mockUser.id, mockCompanyData)).rejects.toThrow(ConflictException);
    });

    it('should validate INN and OGRN', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      corporateProfileRepository.findOneBy.mockResolvedValue(null);

      const invalidData = { ...mockCompanyData, inn: 'invalid' };

      // Act & Assert
      await expect(service.createCorporateProfile(mockUser.id, invalidData)).rejects.toThrow();
    });
  });

  describe('updateCorporateProfile', () => {
    it('should update corporate profile successfully', async () => {
      // Arrange
      const mockProfile = {
        id: 'corp-123',
        companyInfo: {
          name: 'Old Name',
          industry: 'Old Industry',
        },
      } as CorporateProfile;

      corporateProfileRepository.findOneBy.mockResolvedValue(mockProfile);
      corporateProfileRepository.save.mockResolvedValue(mockProfile);

      const updates = {
        companyName: 'New Name',
        industry: 'New Industry',
      };

      // Act
      const result = await service.updateCorporateProfile('corp-123', updates);

      // Assert
      expect(corporateProfileRepository.findOneBy).toHaveBeenCalledWith({ id: 'corp-123' });
      expect(corporateProfileRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith('corporate.profile.updated', expect.any(Object));
      expect(mockProfile.companyInfo.name).toBe('New Name');
      expect(mockProfile.companyInfo.industry).toBe('New Industry');
    });

    it('should throw NotFoundException when profile does not exist', async () => {
      // Arrange
      corporateProfileRepository.findOneBy.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateCorporateProfile('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('addEmployee', () => {
    it('should add employee successfully', async () => {
      // Arrange
      const mockProfile = {
        id: 'corp-123',
        organization: {
          employees: [],
        },
        subscription: {
          usedLicenses: 0,
        },
      } as CorporateProfile;

      const mockEmployee = {
        id: 'emp-123',
        email: 'employee@company.com',
      } as User;

      corporateProfileRepository.findOneBy.mockResolvedValue(mockProfile);
      userRepository.findOneBy.mockResolvedValue(mockEmployee);
      corporateProfileRepository.save.mockResolvedValue(mockProfile);

      const employeeData = {
        userId: 'emp-123',
        role: 'employee' as const,
        department: 'Engineering',
        position: 'Developer',
      };

      // Act
      await service.addEmployee('corp-123', employeeData, 'admin-123');

      // Assert
      expect(corporateProfileRepository.findOneBy).toHaveBeenCalledWith({ id: 'corp-123' });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'emp-123' });
      expect(corporateProfileRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith('corporate.employee.added', expect.any(Object));
      expect(mockProfile.organization.employees).toHaveLength(1);
      expect(mockProfile.subscription.usedLicenses).toBe(1);
    });

    it('should throw NotFoundException when corporate profile does not exist', async () => {
      // Arrange
      corporateProfileRepository.findOneBy.mockResolvedValue(null);

      const employeeData = {
        userId: 'emp-123',
        role: 'employee' as const,
      };

      // Act & Assert
      await expect(service.addEmployee('non-existent', employeeData, 'admin-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const mockProfile = { organization: { employees: [] } } as CorporateProfile;
      corporateProfileRepository.findOneBy.mockResolvedValue(mockProfile);
      userRepository.findOneBy.mockResolvedValue(null);

      const employeeData = {
        userId: 'non-existent',
        role: 'employee' as const,
      };

      // Act & Assert
      await expect(service.addEmployee('corp-123', employeeData, 'admin-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when employee already exists', async () => {
      // Arrange
      const mockProfile = {
        organization: {
          employees: [{ userId: 'emp-123' }],
        },
      } as CorporateProfile;

      const mockEmployee = { id: 'emp-123' } as User;

      corporateProfileRepository.findOneBy.mockResolvedValue(mockProfile);
      userRepository.findOneBy.mockResolvedValue(mockEmployee);

      const employeeData = {
        userId: 'emp-123',
        role: 'employee' as const,
      };

      // Act & Assert
      await expect(service.addEmployee('corp-123', employeeData, 'admin-123')).rejects.toThrow(ConflictException);
    });
  });

  describe('removeEmployee', () => {
    it('should remove employee successfully', async () => {
      // Arrange
      const mockProfile = {
        id: 'corp-123',
        organization: {
          employees: [{ userId: 'emp-123', role: 'employee' }],
        },
        subscription: {
          usedLicenses: 1,
        },
      } as CorporateProfile;

      corporateProfileRepository.findOneBy.mockResolvedValue(mockProfile);
      corporateProfileRepository.save.mockResolvedValue(mockProfile);

      // Act
      await service.removeEmployee('corp-123', 'emp-123');

      // Assert
      expect(corporateProfileRepository.findOneBy).toHaveBeenCalledWith({ id: 'corp-123' });
      expect(corporateProfileRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith('corporate.employee.removed', expect.any(Object));
      expect(mockProfile.organization.employees).toHaveLength(0);
      expect(mockProfile.subscription.usedLicenses).toBe(0);
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      // Arrange
      const mockProfile = {
        organization: {
          employees: [],
        },
      } as CorporateProfile;

      corporateProfileRepository.findOneBy.mockResolvedValue(mockProfile);

      // Act & Assert
      await expect(service.removeEmployee('corp-123', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCorporateProfile', () => {
    it('should return corporate profile successfully', async () => {
      // Arrange
      const mockProfile = { id: 'corp-123' } as CorporateProfile;
      corporateProfileRepository.findOneBy.mockResolvedValue(mockProfile);

      // Act
      const result = await service.getCorporateProfile('corp-123');

      // Assert
      expect(corporateProfileRepository.findOneBy).toHaveBeenCalledWith({ id: 'corp-123' });
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException when profile does not exist', async () => {
      // Arrange
      corporateProfileRepository.findOneBy.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCorporateProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
