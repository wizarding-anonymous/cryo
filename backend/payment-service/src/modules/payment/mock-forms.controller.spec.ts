import { Test, TestingModule } from '@nestjs/testing';
import { MockFormsController } from './mock-forms.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';

describe('MockFormsController', () => {
    let controller: MockFormsController;
    let paymentService: PaymentService;

    const mockPayment: Payment = {
        id: 'test-payment-id',
        orderId: 'test-order-id',
        provider: PaymentProvider.SBERBANK,
        amount: 1000,
        currency: 'RUB',
        status: PaymentStatus.PENDING,
        externalId: 'test-external-id',
        providerResponse: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        order: null,
    };

    const mockPaymentService = {
        getPayment: jest.fn().mockResolvedValue(mockPayment),
        confirmPayment: jest.fn().mockResolvedValue(mockPayment),
        cancelPayment: jest.fn().mockResolvedValue(mockPayment),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MockFormsController],
            providers: [
                {
                    provide: PaymentService,
                    useValue: mockPaymentService,
                },
            ],
        }).compile();

        controller = module.get<MockFormsController>(MockFormsController);
        paymentService = module.get<PaymentService>(PaymentService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('showSberbankForm', () => {
        it('should return Sberbank form data', async () => {
            const result = await controller.showSberbankForm('test-payment-id', 'test-external-id');

            expect(result).toEqual({
                paymentId: 'test-payment-id',
                orderId: 'test-order-id',
                amount: 1000,
                externalId: 'test-external-id',
                provider: 'Сбербанк Онлайн',
                actionUrl: '/mock/sberbank/process/test-payment-id',
            });
            expect(paymentService.getPayment).toHaveBeenCalledWith('test-payment-id');
        });
    });

    describe('showYMoneyForm', () => {
        it('should return YMoney form data', async () => {
            const result = await controller.showYMoneyForm('test-payment-id', 'test-external-id');

            expect(result).toEqual({
                paymentId: 'test-payment-id',
                orderId: 'test-order-id',
                amount: 1000,
                externalId: 'test-external-id',
                provider: 'ЮMoney',
                actionUrl: '/mock/ymoney/process/test-payment-id',
            });
            expect(paymentService.getPayment).toHaveBeenCalledWith('test-payment-id');
        });
    });

    describe('showTBankForm', () => {
        it('should return T-Bank form data', async () => {
            const result = await controller.showTBankForm('test-payment-id', 'test-external-id');

            expect(result).toEqual({
                paymentId: 'test-payment-id',
                orderId: 'test-order-id',
                amount: 1000,
                externalId: 'test-external-id',
                provider: 'Т-Банк',
                actionUrl: '/mock/tbank/process/test-payment-id',
            });
            expect(paymentService.getPayment).toHaveBeenCalledWith('test-payment-id');
        });
    });

    describe('processSberbankPayment', () => {
        it('should confirm payment when action is confirm', async () => {
            const result = await controller.processSberbankPayment('test-payment-id', {
                action: 'confirm',
                externalId: 'test-external-id',
            });

            expect(result).toEqual({
                redirect: '/mock/payment/success/test-payment-id',
            });
            expect(paymentService.confirmPayment).toHaveBeenCalledWith('test-payment-id');
        });

        it('should cancel payment when action is not confirm', async () => {
            const result = await controller.processSberbankPayment('test-payment-id', {
                action: 'cancel',
                externalId: 'test-external-id',
            });

            expect(result).toEqual({
                redirect: '/mock/payment/failure/test-payment-id',
            });
            expect(paymentService.cancelPayment).toHaveBeenCalledWith('test-payment-id');
        });
    });

    describe('processYMoneyPayment', () => {
        it('should confirm payment when action is confirm', async () => {
            const result = await controller.processYMoneyPayment('test-payment-id', {
                action: 'confirm',
                externalId: 'test-external-id',
            });

            expect(result).toEqual({
                redirect: '/mock/payment/success/test-payment-id',
            });
            expect(paymentService.confirmPayment).toHaveBeenCalledWith('test-payment-id');
        });

        it('should cancel payment when action is not confirm', async () => {
            const result = await controller.processYMoneyPayment('test-payment-id', {
                action: 'cancel',
                externalId: 'test-external-id',
            });

            expect(result).toEqual({
                redirect: '/mock/payment/failure/test-payment-id',
            });
            expect(paymentService.cancelPayment).toHaveBeenCalledWith('test-payment-id');
        });
    });

    describe('processTBankPayment', () => {
        it('should confirm payment when action is confirm', async () => {
            const result = await controller.processTBankPayment('test-payment-id', {
                action: 'confirm',
                externalId: 'test-external-id',
            });

            expect(result).toEqual({
                redirect: '/mock/payment/success/test-payment-id',
            });
            expect(paymentService.confirmPayment).toHaveBeenCalledWith('test-payment-id');
        });

        it('should cancel payment when action is not confirm', async () => {
            const result = await controller.processTBankPayment('test-payment-id', {
                action: 'cancel',
                externalId: 'test-external-id',
            });

            expect(result).toEqual({
                redirect: '/mock/payment/failure/test-payment-id',
            });
            expect(paymentService.cancelPayment).toHaveBeenCalledWith('test-payment-id');
        });
    });
});