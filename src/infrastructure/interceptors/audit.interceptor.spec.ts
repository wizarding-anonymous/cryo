import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from '../../application/services/audit.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: AuditService;
  let reflector: Reflector;

  const mockAuditService = {
    logAction: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: AuditService, useValue: mockAuditService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    auditService = module.get<AuditService>(AuditService);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should log an action if metadata is present', (done) => {
    mockReflector.get.mockImplementation((key) => {
      if (key === 'audit-action') return 'test.action';
      if (key === 'audit-resource') return 'test_resource';
      return null;
    });

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
            user: { userId: 'user-123' },
            params: { id: 'resource-123' },
            method: 'POST',
            originalUrl: '/test',
            ip: '127.0.0.1',
            get: () => 'Test-Agent',
        }),
        getResponse: () => ({ statusCode: 201 }),
      }),
      getHandler: () => {},
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of('test response'),
    };

    interceptor.intercept(mockContext, next).subscribe({
      complete: () => {
        expect(mockAuditService.logAction).toHaveBeenCalled();
        expect(mockAuditService.logAction).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'test.action' })
        );
        done();
      }
    });
  });
});
