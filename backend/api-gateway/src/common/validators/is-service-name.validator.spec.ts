import { validate } from 'class-validator';
import { IsServiceName } from './is-service-name.validator';
import { ServiceName } from '../enums/service-name.enum';

class TestClass {
  @IsServiceName()
  serviceName: any;
}

describe('IsServiceName Validator', () => {
  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  describe('valid service names', () => {
    it('should pass for USER service', async () => {
      testInstance.serviceName = ServiceName.USER;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for GAME_CATALOG service', async () => {
      testInstance.serviceName = ServiceName.GAME_CATALOG;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for PAYMENT service', async () => {
      testInstance.serviceName = ServiceName.PAYMENT;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for LIBRARY service', async () => {
      testInstance.serviceName = ServiceName.LIBRARY;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for NOTIFICATION service', async () => {
      testInstance.serviceName = ServiceName.NOTIFICATION;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for REVIEW service', async () => {
      testInstance.serviceName = ServiceName.REVIEW;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for ACHIEVEMENT service', async () => {
      testInstance.serviceName = ServiceName.ACHIEVEMENT;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for SECURITY service', async () => {
      testInstance.serviceName = ServiceName.SECURITY;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for SOCIAL service', async () => {
      testInstance.serviceName = ServiceName.SOCIAL;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for DOWNLOAD service', async () => {
      testInstance.serviceName = ServiceName.DOWNLOAD;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for API_GATEWAY service', async () => {
      testInstance.serviceName = ServiceName.API_GATEWAY;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for all enum values', async () => {
      const allServiceNames = Object.values(ServiceName);

      for (const serviceName of allServiceNames) {
        testInstance.serviceName = serviceName;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('invalid service names', () => {
    it('should fail for invalid string service name', async () => {
      testInstance.serviceName = 'invalid-service';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validServices = Object.values(ServiceName).join(', ');
      expect(errors[0].constraints?.IsServiceName).toBe(
        `serviceName must be one of: ${validServices}`,
      );
    });

    it('should fail for empty string', async () => {
      testInstance.serviceName = '';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validServices = Object.values(ServiceName).join(', ');
      expect(errors[0].constraints?.IsServiceName).toBe(
        `serviceName must be one of: ${validServices}`,
      );
    });

    it('should fail for null', async () => {
      testInstance.serviceName = null;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validServices = Object.values(ServiceName).join(', ');
      expect(errors[0].constraints?.IsServiceName).toBe(
        `serviceName must be one of: ${validServices}`,
      );
    });

    it('should fail for undefined', async () => {
      testInstance.serviceName = undefined;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validServices = Object.values(ServiceName).join(', ');
      expect(errors[0].constraints?.IsServiceName).toBe(
        `serviceName must be one of: ${validServices}`,
      );
    });

    it('should fail for number values', async () => {
      testInstance.serviceName = 123;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validServices = Object.values(ServiceName).join(', ');
      expect(errors[0].constraints?.IsServiceName).toBe(
        `serviceName must be one of: ${validServices}`,
      );
    });

    it('should fail for boolean values', async () => {
      testInstance.serviceName = true;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      testInstance.serviceName = false;
      const errors2 = await validate(testInstance);
      expect(errors2).toHaveLength(1);
    });

    it('should fail for object values', async () => {
      testInstance.serviceName = { service: 'user-service' };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validServices = Object.values(ServiceName).join(', ');
      expect(errors[0].constraints?.IsServiceName).toBe(
        `serviceName must be one of: ${validServices}`,
      );
    });

    it('should fail for array values', async () => {
      testInstance.serviceName = ['user-service'];
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validServices = Object.values(ServiceName).join(', ');
      expect(errors[0].constraints?.IsServiceName).toBe(
        `serviceName must be one of: ${validServices}`,
      );
    });

    it('should fail for function values', async () => {
      testInstance.serviceName = () => 'user-service';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for case-sensitive variations', async () => {
      const caseVariations = [
        'USER-SERVICE',
        'User-Service',
        'user-Service',
        'USER_SERVICE',
        'userService',
        'UserService',
      ];

      for (const variation of caseVariations) {
        testInstance.serviceName = variation;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);

        const validServices = Object.values(ServiceName).join(', ');
        expect(errors[0].constraints?.IsServiceName).toBe(
          `serviceName must be one of: ${validServices}`,
        );
      }
    });

    it('should fail for partial service names', async () => {
      const partialNames = [
        'user',
        'service',
        'user-',
        '-service',
        'game-catalog',
        'catalog-service',
      ];

      for (const partialName of partialNames) {
        testInstance.serviceName = partialName;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
      }
    });

    it('should fail for service names with extra characters', async () => {
      const extraCharNames = [
        'user-service-extra',
        ' user-service',
        'user-service ',
        'user-service\n',
        'user-service\t',
        'user--service',
        'user_service',
      ];

      for (const extraCharName of extraCharNames) {
        testInstance.serviceName = extraCharName;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
      }
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsServiceName({ message: 'Please provide a valid service name' })
        serviceName: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.serviceName = 'invalid-service';

      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsServiceName).toBe(
        'Please provide a valid service name',
      );
    });
  });

  describe('error message content', () => {
    it('should include all valid service names in error message', async () => {
      testInstance.serviceName = 'invalid-service';
      const errors = await validate(testInstance);

      const errorMessage = errors[0].constraints?.IsServiceName;
      const allServiceNames = Object.values(ServiceName);

      // Check that all service names are mentioned in the error message
      for (const serviceName of allServiceNames) {
        expect(errorMessage).toContain(serviceName);
      }
    });
  });
});
