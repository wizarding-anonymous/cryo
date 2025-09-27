import { validate } from 'class-validator';
import { IsTimeout } from './is-timeout.validator';

class TestClass {
  @IsTimeout()
  timeout: any;
}

class TestClassWithCustomRange {
  @IsTimeout(500, 10000)
  timeout: any;
}

describe('IsTimeout Validator', () => {
  let testInstance: TestClass;
  let testInstanceCustom: TestClassWithCustomRange;

  beforeEach(() => {
    testInstance = new TestClass();
    testInstanceCustom = new TestClassWithCustomRange();
  });

  describe('default range (1000-300000)', () => {
    describe('valid timeout values', () => {
      it('should pass for minimum timeout (1000)', async () => {
        testInstance.timeout = 1000;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      });

      it('should pass for maximum timeout (300000)', async () => {
        testInstance.timeout = 300000;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      });

      it('should pass for timeout in middle range', async () => {
        testInstance.timeout = 5000;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      });

      it('should pass for various valid integer values', async () => {
        const validTimeouts = [
          1000, 1500, 3000, 5000, 10000, 30000, 60000, 120000, 300000,
        ];

        for (const timeout of validTimeouts) {
          testInstance.timeout = timeout;
          const errors = await validate(testInstance);
          expect(errors).toHaveLength(0);
        }
      });

      it('should pass for valid string numbers', async () => {
        testInstance.timeout = '5000';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      });

      it('should pass for minimum timeout as string', async () => {
        testInstance.timeout = '1000';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      });

      it('should pass for maximum timeout as string', async () => {
        testInstance.timeout = '300000';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      });

      it('should pass for string numbers with leading zeros', async () => {
        testInstance.timeout = '05000';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      });
    });

    describe('invalid timeout values', () => {
      it('should fail for timeout below minimum (999)', async () => {
        testInstance.timeout = 999;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for timeout above maximum (300001)', async () => {
        testInstance.timeout = 300001;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for zero timeout', async () => {
        testInstance.timeout = 0;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for negative timeout', async () => {
        testInstance.timeout = -1000;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for floating point numbers', async () => {
        testInstance.timeout = 5000.5;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for string numbers below minimum', async () => {
        testInstance.timeout = '999';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for string numbers above maximum', async () => {
        testInstance.timeout = '300001';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for non-numeric strings', async () => {
        testInstance.timeout = 'not-a-number';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for empty string', async () => {
        testInstance.timeout = '';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for string with decimal', async () => {
        testInstance.timeout = '5000.5';
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for null', async () => {
        testInstance.timeout = null;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for undefined', async () => {
        testInstance.timeout = undefined;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for boolean values', async () => {
        testInstance.timeout = true;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );

        testInstance.timeout = false;
        const errors2 = await validate(testInstance);
        expect(errors2).toHaveLength(1);
      });

      it('should fail for object values', async () => {
        testInstance.timeout = { timeout: 5000 };
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for array values', async () => {
        testInstance.timeout = [5000];
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 1000ms and 300000ms',
        );
      });

      it('should fail for function values', async () => {
        testInstance.timeout = () => 5000;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
      });

      it('should fail for Infinity', async () => {
        testInstance.timeout = Infinity;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
      });

      it('should fail for NaN', async () => {
        testInstance.timeout = NaN;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
      });
    });
  });

  describe('custom range (500-10000)', () => {
    describe('valid timeout values', () => {
      it('should pass for minimum timeout (500)', async () => {
        testInstanceCustom.timeout = 500;
        const errors = await validate(testInstanceCustom);
        expect(errors).toHaveLength(0);
      });

      it('should pass for maximum timeout (10000)', async () => {
        testInstanceCustom.timeout = 10000;
        const errors = await validate(testInstanceCustom);
        expect(errors).toHaveLength(0);
      });

      it('should pass for timeout in middle range', async () => {
        testInstanceCustom.timeout = 5000;
        const errors = await validate(testInstanceCustom);
        expect(errors).toHaveLength(0);
      });

      it('should pass for valid string numbers in custom range', async () => {
        testInstanceCustom.timeout = '7500';
        const errors = await validate(testInstanceCustom);
        expect(errors).toHaveLength(0);
      });
    });

    describe('invalid timeout values', () => {
      it('should fail for timeout below custom minimum (499)', async () => {
        testInstanceCustom.timeout = 499;
        const errors = await validate(testInstanceCustom);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 500ms and 10000ms',
        );
      });

      it('should fail for timeout above custom maximum (10001)', async () => {
        testInstanceCustom.timeout = 10001;
        const errors = await validate(testInstanceCustom);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 500ms and 10000ms',
        );
      });

      it('should fail for default valid value outside custom range', async () => {
        // 15000 would be valid in default range but not in custom range
        testInstanceCustom.timeout = 15000;
        const errors = await validate(testInstanceCustom);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsTimeout).toBe(
          'timeout must be a timeout value between 500ms and 10000ms',
        );
      });
    });
  });

  describe('edge cases', () => {
    it('should handle string with whitespace', async () => {
      testInstance.timeout = ' 5000 ';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0); // parseInt should handle whitespace
    });

    it('should handle string with plus sign', async () => {
      testInstance.timeout = '+5000';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should fail for string with non-numeric suffix', async () => {
      testInstance.timeout = '5000ms';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for hexadecimal string', async () => {
      testInstance.timeout = '0x1388'; // 5000 in hex
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for octal string', async () => {
      testInstance.timeout = '011750'; // 5000 in octal
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for scientific notation string', async () => {
      testInstance.timeout = '5e3'; // 5000 in scientific notation
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsTimeout(1000, 60000, {
          message: 'Please provide a valid timeout between 1-60 seconds',
        })
        timeout: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.timeout = 500;

      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsTimeout).toBe(
        'Please provide a valid timeout between 1-60 seconds',
      );
    });
  });
});
