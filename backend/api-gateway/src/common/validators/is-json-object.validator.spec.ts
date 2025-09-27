import { validate } from 'class-validator';
import { IsJsonObject } from './is-json-object.validator';

class TestClass {
  @IsJsonObject()
  jsonObject: any;
}

describe('IsJsonObject Validator', () => {
  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  describe('valid JSON objects', () => {
    it('should pass for valid object', async () => {
      testInstance.jsonObject = { name: 'John', age: 30 };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for empty object', async () => {
      testInstance.jsonObject = {};
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for nested object', async () => {
      testInstance.jsonObject = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            preferences: ['music', 'sports'],
          },
        },
      };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for object with various data types', async () => {
      testInstance.jsonObject = {
        string: 'test',
        number: 42,
        boolean: true,
        nullValue: null,
        array: [1, 2, 3],
        nestedObject: { key: 'value' },
      };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for Date object', async () => {
      testInstance.jsonObject = new Date();
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for RegExp object', async () => {
      testInstance.jsonObject = /test/g;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for class instance', async () => {
      class CustomClass {
        constructor(public name: string) {}
      }
      testInstance.jsonObject = new CustomClass('test');
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });
  });

  describe('valid JSON strings', () => {
    it('should pass for valid JSON object string', async () => {
      testInstance.jsonObject = '{"name": "John", "age": 30}';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for empty JSON object string', async () => {
      testInstance.jsonObject = '{}';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for complex JSON object string', async () => {
      testInstance.jsonObject =
        '{"user": {"name": "John", "profile": {"age": 30}}}';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for JSON object string with null values', async () => {
      testInstance.jsonObject = '{"name": "John", "age": null}';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid values', () => {
    it('should fail for null', async () => {
      testInstance.jsonObject = null;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for undefined', async () => {
      testInstance.jsonObject = undefined;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for arrays', async () => {
      testInstance.jsonObject = [1, 2, 3];
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for empty array', async () => {
      testInstance.jsonObject = [];
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for string values', async () => {
      testInstance.jsonObject = 'not a json object';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for number values', async () => {
      testInstance.jsonObject = 123;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for boolean values', async () => {
      testInstance.jsonObject = true;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );

      testInstance.jsonObject = false;
      const errors2 = await validate(testInstance);
      expect(errors2).toHaveLength(1);
      expect(errors2[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for function values', async () => {
      testInstance.jsonObject = () => 'test';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for symbol values', async () => {
      testInstance.jsonObject = Symbol('test');
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });
  });

  describe('invalid JSON strings', () => {
    it('should fail for invalid JSON string', async () => {
      testInstance.jsonObject = '{"invalid": json}';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for JSON array string', async () => {
      testInstance.jsonObject = '[1, 2, 3]';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for JSON string with primitive values', async () => {
      testInstance.jsonObject = '"just a string"';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );

      testInstance.jsonObject = '123';
      const errors2 = await validate(testInstance);
      expect(errors2).toHaveLength(1);
      expect(errors2[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );

      testInstance.jsonObject = 'true';
      const errors3 = await validate(testInstance);
      expect(errors3).toHaveLength(1);
      expect(errors3[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );

      testInstance.jsonObject = 'null';
      const errors4 = await validate(testInstance);
      expect(errors4).toHaveLength(1);
      expect(errors4[0].constraints?.IsJsonObject).toBe(
        'jsonObject must be a valid JSON object',
      );
    });

    it('should fail for malformed JSON strings', async () => {
      const malformedJsonStrings = [
        '{name: "John"}', // missing quotes around key
        '{"name": "John",}', // trailing comma
        '{"name": John}', // unquoted string value
        '{name: John}', // unquoted key and value
        '{"name": "John" "age": 30}', // missing comma
        '{"name": "John", age: 30}', // mixed quoted/unquoted
      ];

      for (const malformedJson of malformedJsonStrings) {
        testInstance.jsonObject = malformedJson;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.IsJsonObject).toBe(
          'jsonObject must be a valid JSON object',
        );
      }
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsJsonObject({ message: 'Custom error message for JSON object' })
        jsonObject: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.jsonObject = 'invalid';

      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsJsonObject).toBe(
        'Custom error message for JSON object',
      );
    });
  });
});
