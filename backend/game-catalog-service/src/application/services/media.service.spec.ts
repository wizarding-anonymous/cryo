import { Test, TestingModule } from '@nestjs/testing';
import { MediaService, MediaType } from './media.service';
import { ConfigService } from '@nestjs/config';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { ScreenshotRepository } from '../../infrastructure/persistence/screenshot.repository';
import { VideoRepository } from '../../infrastructure/persistence/video.repository';
import { S3Client } from '@aws-sdk/client-s3';
import { Game } from '../../domain/entities/game.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as sharp from 'sharp';

// Mock the S3Client's send method
jest.mock('@aws-sdk/client-s3', () => {
  const S3Client = jest.fn(() => ({
    send: jest.fn(),
  }));
  return { ...jest.requireActual('@aws-sdk/client-s3'), S3Client };
});

// Mock the sharp library
jest.mock('sharp');

describe('MediaService', () => {
  let service: MediaService;
  let gameRepository: GameRepository;
  let s3Client: S3Client;

  const mockGameRepository = {
    findById: jest.fn(),
  };
  const mockScreenshotRepository = {
    create: jest.fn().mockImplementation(s => Promise.resolve(s)),
  };
  const mockVideoRepository = {
    create: jest.fn().mockImplementation(v => Promise.resolve(v)),
  };
  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 's3.endpoint': return 'http://localhost:9000';
        case 's3.bucket': return 'test-bucket';
        default: return key;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: ScreenshotRepository, useValue: mockScreenshotRepository },
        { provide: VideoRepository, useValue: mockVideoRepository },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    gameRepository = module.get<GameRepository>(GameRepository);
    s3Client = (service as any).s3Client;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    const mockFile: Express.Multer.File = {
      buffer: Buffer.from('test'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
      fieldname: 'file',
      encoding: '7bit',
      size: 1024,
      destination: '',
      filename: '',
      path: '',
      stream: null,
    };
    const mockGame = new Game();
    mockGame.id = 'test-game-id';

    const mockSharpInstance = {
      resize: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('thumbnail')),
    };
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);


    it('should upload a screenshot, create a thumbnail, and save it', async () => {
      mockGameRepository.findById.mockResolvedValue(mockGame);
      (s3Client.send as jest.Mock).mockResolvedValue({});

      await service.uploadFile(mockFile, mockGame.id, MediaType.SCREENSHOT);

      expect(gameRepository.findById).toHaveBeenCalledWith(mockGame.id);
      expect(s3Client.send).toHaveBeenCalledTimes(2); // Original and thumbnail
      expect(sharp).toHaveBeenCalledWith(mockFile.buffer);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(200, 200, { fit: 'inside' });
      expect(mockScreenshotRepository.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if game does not exist', async () => {
      mockGameRepository.findById.mockResolvedValue(null);
      await expect(service.uploadFile(mockFile, 'bad-id', MediaType.SCREENSHOT)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid screenshot file type', async () => {
        mockGameRepository.findById.mockResolvedValue(mockGame);
        const badFile = { ...mockFile, mimetype: 'video/mp4' };
        await expect(service.uploadFile(badFile, mockGame.id, MediaType.SCREENSHOT)).rejects.toThrow(BadRequestException);
    });

    it('should throw an error if S3 upload fails', async () => {
        mockGameRepository.findById.mockResolvedValue(mockGame);
        (s3Client.send as jest.Mock).mockRejectedValue(new Error('S3 Error'));
        await expect(service.uploadFile(mockFile, mockGame.id, MediaType.SCREENSHOT)).rejects.toThrow('Failed to upload file.');
    });
  });

  describe('uploadFile for Videos', () => {
    const mockVideoFile: Express.Multer.File = {
        buffer: Buffer.from('video_test'),
        mimetype: 'video/mp4',
        originalname: 'test.mp4',
        fieldname: 'file',
        encoding: '7bit',
        size: 5 * 1024 * 1024,
        destination: '',
        filename: '',
        path: '',
        stream: null,
      };
      const mockGame = new Game();
      mockGame.id = 'test-game-id';

      it('should upload a video and save it', async () => {
        mockGameRepository.findById.mockResolvedValue(mockGame);
        (s3Client.send as jest.Mock).mockResolvedValue({});

        await service.uploadFile(mockVideoFile, mockGame.id, MediaType.VIDEO);

        expect(gameRepository.findById).toHaveBeenCalledWith(mockGame.id);
        expect(s3Client.send).toHaveBeenCalledTimes(1); // Only original video
        expect(mockVideoRepository.create).toHaveBeenCalled();
      });

      it('should throw BadRequestException for invalid video file type', async () => {
        mockGameRepository.findById.mockResolvedValue(mockGame);
        const badFile = { ...mockVideoFile, mimetype: 'image/jpeg' };
        await expect(service.uploadFile(badFile, mockGame.id, MediaType.VIDEO)).rejects.toThrow(BadRequestException);
    });
  });
});
