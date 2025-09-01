import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '../../src/application/events/event-publisher.service';
import { OutboxRepository } from '../../src/infrastructure/persistence/repositories/outbox.repository';
import { KAFKA_SERVICE } from '../../src/infrastructure/event-emitters/kafka.module';
import { ClientKafka } from '@nestjs/microservices';
import { IsString } from 'class-validator';

// A simple event schema for testing
class TestEvent {
  @IsString()
  message: string;
}

describe('EventPublisher (Integration)', () => {
  let eventPublisher: EventPublisher;
  let kafkaClientMock: ClientKafka;
  let outboxRepositoryMock: OutboxRepository;

  const mockKafkaClient = {
    emit: jest.fn(),
  };

  const mockOutboxRepository = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisher,
        {
          provide: KAFKA_SERVICE,
          useValue: mockKafkaClient,
        },
        {
          provide: OutboxRepository,
          useValue: mockOutboxRepository,
        },
      ],
    }).compile();

    eventPublisher = module.get<EventPublisher>(EventPublisher);
    kafkaClientMock = module.get<ClientKafka>(KAFKA_SERVICE);
    outboxRepositoryMock = module.get<OutboxRepository>(OutboxRepository);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(eventPublisher).toBeDefined();
  });

  it('should publish an event successfully on the first attempt', async () => {
    mockKafkaClient.emit.mockResolvedValueOnce(undefined);

    await eventPublisher.publish('test_topic', { message: 'hello' }, TestEvent);

    expect(kafkaClientMock.emit).toHaveBeenCalledTimes(1);
    expect(kafkaClientMock.emit).toHaveBeenCalledWith('test_topic', { message: 'hello' });
    expect(outboxRepositoryMock.save).not.toHaveBeenCalled();
  });

  it('should publish an event after one failed attempt', async () => {
    mockKafkaClient.emit.mockRejectedValueOnce(new Error('Kafka connection error')).mockResolvedValueOnce(undefined);

    await eventPublisher.publish('test_topic', { message: 'hello' }, TestEvent);

    expect(kafkaClientMock.emit).toHaveBeenCalledTimes(2);
    expect(outboxRepositoryMock.save).not.toHaveBeenCalled();
  });

  it('should save an event to the outbox after all attempts fail', async () => {
    mockKafkaClient.emit.mockRejectedValue(new Error('Kafka is down'));

    await eventPublisher.publish('test_topic', { message: 'hello' }, TestEvent);

    expect(kafkaClientMock.emit).toHaveBeenCalledTimes(3);
    expect(outboxRepositoryMock.save).toHaveBeenCalledTimes(1);
    expect(outboxRepositoryMock.save).toHaveBeenCalledWith({
      topic: 'test_topic',
      data: { message: 'hello' },
    });
  });

  it('should throw an error and not publish if event validation fails', async () => {
    const invalidEventData = { message: 123 }; // message should be a string

    await expect(eventPublisher.publish('test_topic', invalidEventData, TestEvent)).rejects.toThrow(
      'Event validation failed',
    );

    expect(kafkaClientMock.emit).not.toHaveBeenCalled();
    expect(outboxRepositoryMock.save).not.toHaveBeenCalled();
  });
});
