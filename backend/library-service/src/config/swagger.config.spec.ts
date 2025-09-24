import { DocumentBuilder } from '@nestjs/swagger';
import { createSwaggerConfig, swaggerOptions } from './swagger.config';
import { SwaggerExamples } from './swagger-examples';

describe('Swagger Configuration', () => {
  describe('createSwaggerConfig', () => {
    it('should create a valid Swagger configuration with default values', () => {
      const config = createSwaggerConfig();

      expect(config.info.title).toBe('Library Service API');
      expect(config.info.version).toBe('1.0.0');
      expect(config.info.description).toContain('Library Service API');
      expect(config.info.contact).toBeDefined();
      expect(config.info.license).toBeDefined();
    });

    it('should create a valid Swagger configuration with custom values', () => {
      const customTitle = 'Custom Library API';
      const customDescription = 'Custom description';
      const customVersion = '2.0.0';
      const customServerUrl = 'https://custom.example.com';
      const customServerDescription = 'Custom server';

      const config = createSwaggerConfig(
        customTitle,
        customDescription,
        customVersion,
        customServerUrl,
        customServerDescription,
      );

      expect(config.info.title).toBe(customTitle);
      expect(config.info.description).toBe(customDescription);
      expect(config.info.version).toBe(customVersion);
      expect(config.servers).toContainEqual({
        url: customServerUrl,
        description: customServerDescription,
      });
    });

    it('should include required security schemes', () => {
      const config = createSwaggerConfig();

      expect(config.components?.securitySchemes).toBeDefined();
      expect(config.components?.securitySchemes?.['JWT-auth']).toBeDefined();

      // Type assertion to access properties safely
      const jwtAuth = config.components?.securitySchemes?.['JWT-auth'];
      if (jwtAuth && 'type' in jwtAuth) {
        expect(jwtAuth.type).toBe('http');
        expect((jwtAuth as any).scheme).toBe('bearer');
      }
    });

    it('should include all required tags', () => {
      const config = createSwaggerConfig();
      const expectedTags = ['Library', 'Purchase History', 'Health', 'Metrics'];

      expect(config.tags).toBeDefined();
      const tagNames = config.tags?.map((tag) => tag.name) || [];

      expectedTags.forEach((expectedTag) => {
        expect(tagNames).toContain(expectedTag);
      });
    });

    it('should include multiple servers', () => {
      const config = createSwaggerConfig();

      expect(config.servers).toBeDefined();
      expect(config.servers?.length).toBeGreaterThanOrEqual(2);

      const serverUrls = config.servers?.map((server) => server.url) || [];
      expect(serverUrls).toContain('http://localhost:3000');
      expect(serverUrls).toContain('https://api.yourgamingplatform.ru');
    });
  });

  describe('swaggerOptions', () => {
    it('should have proper UI configuration', () => {
      expect(swaggerOptions.explorer).toBe(true);
      expect(swaggerOptions.swaggerOptions.persistAuthorization).toBe(true);
      expect(swaggerOptions.swaggerOptions.displayRequestDuration).toBe(true);
      expect(swaggerOptions.swaggerOptions.tryItOutEnabled).toBe(true);
    });

    it('should have custom styling', () => {
      expect(swaggerOptions.customSiteTitle).toBe(
        'Library Service API Documentation',
      );
      expect(swaggerOptions.customCss).toContain(
        '.swagger-ui .topbar { display: none; }',
      );
      expect(swaggerOptions.customCssUrl).toBeDefined();
      expect(swaggerOptions.customJs).toBeDefined();
    });
  });

  describe('SwaggerExamples', () => {
    it('should have library examples', () => {
      expect(SwaggerExamples.library).toBeDefined();
      expect(SwaggerExamples.library.userLibrary).toBeDefined();
      expect(SwaggerExamples.library.emptyLibrary).toBeDefined();
      expect(SwaggerExamples.library.searchResults).toBeDefined();
    });

    it('should have ownership examples', () => {
      expect(SwaggerExamples.ownership).toBeDefined();
      expect(SwaggerExamples.ownership.owned).toBeDefined();
      expect(SwaggerExamples.ownership.notOwned).toBeDefined();
    });

    it('should have history examples', () => {
      expect(SwaggerExamples.history).toBeDefined();
      expect(SwaggerExamples.history.purchaseHistory).toBeDefined();
      expect(SwaggerExamples.history.refundedPurchase).toBeDefined();
    });

    it('should have error examples', () => {
      expect(SwaggerExamples.errors).toBeDefined();
      expect(SwaggerExamples.errors.validation).toBeDefined();
      expect(SwaggerExamples.errors.unauthorized).toBeDefined();
      expect(SwaggerExamples.errors.gameNotOwned).toBeDefined();
      expect(SwaggerExamples.errors.duplicateGame).toBeDefined();
    });

    it('should have request examples', () => {
      expect(SwaggerExamples.requests).toBeDefined();
      expect(SwaggerExamples.requests.addGameToLibrary).toBeDefined();
      expect(SwaggerExamples.requests.removeGameFromLibrary).toBeDefined();
    });

    it('should have valid example data structure', () => {
      const libraryExample = SwaggerExamples.library.userLibrary.value;

      expect(libraryExample.games).toBeDefined();
      expect(Array.isArray(libraryExample.games)).toBe(true);
      expect(libraryExample.pagination).toBeDefined();
      expect(libraryExample.pagination.total).toBeDefined();
      expect(libraryExample.pagination.page).toBeDefined();
      expect(libraryExample.pagination.limit).toBeDefined();
      expect(libraryExample.pagination.totalPages).toBeDefined();

      if (libraryExample.games.length > 0) {
        const game = libraryExample.games[0];
        expect(game.id).toBeDefined();
        expect(game.gameId).toBeDefined();
        expect(game.userId).toBeDefined();
        expect(game.purchaseDate).toBeDefined();
        expect(game.purchasePrice).toBeDefined();
        expect(game.currency).toBeDefined();
        expect(game.orderId).toBeDefined();

        if (game.gameDetails) {
          expect(game.gameDetails.title).toBeDefined();
          expect(game.gameDetails.developer).toBeDefined();
          expect(game.gameDetails.publisher).toBeDefined();
        }
      }
    });

    it('should have valid ownership example data', () => {
      const ownedExample = SwaggerExamples.ownership.owned.value;
      const notOwnedExample = SwaggerExamples.ownership.notOwned.value;

      expect(ownedExample.owns).toBe(true);
      expect(ownedExample.purchaseDate).toBeDefined();
      expect(ownedExample.purchasePrice).toBeDefined();
      expect(ownedExample.currency).toBeDefined();

      expect(notOwnedExample.owns).toBe(false);
      // Check that optional properties are not present in notOwned example
      expect('purchaseDate' in notOwnedExample).toBe(false);
      expect('purchasePrice' in notOwnedExample).toBe(false);
      expect('currency' in notOwnedExample).toBe(false);
    });

    it('should have valid error example data', () => {
      const validationError = SwaggerExamples.errors.validation.value;

      expect(validationError.statusCode).toBe(400);
      expect(validationError.message).toBeDefined();
      expect(validationError.error).toBe('VALIDATION_ERROR');
      expect(validationError.details).toBeDefined();
      expect(Array.isArray(validationError.details)).toBe(true);

      if (validationError.details.length > 0) {
        const detail = validationError.details[0];
        expect(detail.field).toBeDefined();
        expect(detail.message).toBeDefined();
      }
    });
  });

  describe('DocumentBuilder Integration', () => {
    it('should work with NestJS DocumentBuilder', () => {
      const builder = new DocumentBuilder();

      expect(() => {
        builder
          .setTitle('Test API')
          .setDescription('Test Description')
          .setVersion('1.0.0')
          .addBearerAuth()
          .addTag('Test')
          .build();
      }).not.toThrow();
    });

    it('should create a complete OpenAPI document structure', () => {
      const config = new DocumentBuilder()
        .setTitle('Library Service API')
        .setDescription('API for managing user game libraries')
        .setVersion('1.0.0')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          'JWT-auth',
        )
        .addTag('Library')
        .addTag('Purchase History')
        .addTag('Health')
        .addTag('Metrics')
        .build();

      expect(config.info).toBeDefined();
      expect(config.info.title).toBe('Library Service API');
      expect(config.info.version).toBe('1.0.0');
      expect(config.components?.securitySchemes).toBeDefined();
      expect(config.tags).toBeDefined();
      expect(config.tags?.length).toBeGreaterThanOrEqual(4);
    });
  });
});
