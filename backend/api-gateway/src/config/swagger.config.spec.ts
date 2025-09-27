import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { setupSwagger } from './swagger.config';
import request from 'supertest';

describe('Swagger Configuration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Swagger Documentation', () => {
    it('should serve Swagger UI at /api-docs', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs')
        .expect(200);

      expect(response.text).toContain('swagger-ui');
      expect(response.text).toContain('Cryo API Gateway Documentation');
    });

    it('should serve OpenAPI JSON specification', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);

      const spec = response.body;

      // Проверяем основную информацию
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe('Cryo Gaming Platform API Gateway');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.info.contact).toBeDefined();
      expect(spec.info.license).toBeDefined();

      // Проверяем серверы
      expect(spec.servers).toBeDefined();
      expect(spec.servers).toHaveLength(3);
      expect(spec.servers[0].url).toBe('http://localhost:3000');

      // Проверяем теги
      expect(spec.tags).toBeDefined();
      expect(spec.tags.some((tag: any) => tag.name === 'Proxy')).toBe(true);
      expect(spec.tags.some((tag: any) => tag.name === 'Health')).toBe(true);
      expect(spec.tags.some((tag: any) => tag.name === 'Metrics')).toBe(true);

      // Проверяем схемы аутентификации
      expect(spec.components.securitySchemes).toBeDefined();
      expect(spec.components.securitySchemes['JWT-auth']).toBeDefined();
      expect(spec.components.securitySchemes['JWT-auth'].type).toBe('http');
      expect(spec.components.securitySchemes['JWT-auth'].scheme).toBe('bearer');
    });

    it('should include all controller endpoints in specification', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);

      const spec = response.body;
      const paths = Object.keys(spec.paths);

      // Проверяем наличие основных путей
      expect(paths.some((path) => path.includes('health'))).toBe(true);
      expect(paths.some((path) => path.includes('metrics'))).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should include proper response schemas', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);

      const spec = response.body;

      // Проверяем наличие схем DTO
      expect(spec.components.schemas).toBeDefined();
      expect(spec.components.schemas.ErrorResponseDto).toBeDefined();
      expect(spec.components.schemas.HealthCheckResultDto).toBeDefined();
      expect(spec.components.schemas.ServiceHealthStatusDto).toBeDefined();
      // Проверяем что есть хотя бы несколько схем
      expect(Object.keys(spec.components.schemas).length).toBeGreaterThan(2);
    });

    it('should include proper operation descriptions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);

      const spec = response.body;

      // Проверяем описания операций
      const healthPath = spec.paths['/health'];
      expect(healthPath).toBeDefined();
      expect(healthPath.get).toBeDefined();
      expect(healthPath.get.summary).toContain('Проверка состояния');
      expect(healthPath.get.description).toBeDefined();
      expect(healthPath.get.description.length).toBeGreaterThan(50);

      const metricsPath = spec.paths['/metrics'];
      expect(metricsPath).toBeDefined();
      expect(metricsPath.get).toBeDefined();
      expect(metricsPath.get.summary).toContain('Prometheus метрики');
      expect(metricsPath.get.description).toBeDefined();
      expect(metricsPath.get.description.length).toBeGreaterThan(100);
    });

    it('should include proper response examples', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);

      const spec = response.body;

      // Проверяем примеры ответов для health endpoint
      const healthPath = spec.paths['/health'];
      const healthResponses = healthPath.get.responses;

      expect(healthResponses['200']).toBeDefined();
      expect(healthResponses['200'].content).toBeDefined();
      expect(healthResponses['200'].content['application/json']).toBeDefined();

      // Проверяем примеры для metrics endpoint
      const metricsPath = spec.paths['/metrics'];
      const metricsResponses = metricsPath.get.responses;

      expect(metricsResponses['200']).toBeDefined();
      expect(metricsResponses['200'].content).toBeDefined();
      expect(metricsResponses['200'].content['text/plain']).toBeDefined();
      expect(
        metricsResponses['200'].content['text/plain'].example,
      ).toBeDefined();
    });

    it('should include proper error response schemas', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);

      const spec = response.body;

      // Проверяем схему ErrorResponseDto
      const errorSchema = spec.components.schemas.ErrorResponseDto;
      expect(errorSchema).toBeDefined();
      expect(errorSchema.properties).toBeDefined();
      expect(errorSchema.properties.error).toBeDefined();
      expect(errorSchema.properties.message).toBeDefined();
      expect(errorSchema.properties.statusCode).toBeDefined();
      expect(errorSchema.properties.timestamp).toBeDefined();
      expect(errorSchema.properties.path).toBeDefined();

      // Проверяем примеры в свойствах
      expect(errorSchema.properties.error.example).toBeDefined();
      expect(errorSchema.properties.message.example).toBeDefined();
      expect(errorSchema.properties.statusCode.example).toBeDefined();
    });
  });

  describe('Swagger UI Customization', () => {
    it('should include custom CSS styling', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs')
        .expect(200);

      expect(response.text).toContain('background-color: #1a1a2e');
      expect(response.text).toContain('Cryo API Gateway Documentation');
    });

    it('should include custom Swagger options', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs')
        .expect(200);

      // Проверяем что включены нужные опции (они могут быть в swagger-ui-init.js)
      expect(response.text).toContain('swagger-ui-init.js');
      expect(response.text).toContain('swagger-ui-bundle.js');
      expect(response.text).toContain('swagger-ui');
    });
  });
});
