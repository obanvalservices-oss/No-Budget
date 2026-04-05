import { Test, TestingModule } from '@nestjs/testing';
import { AhorrosController } from './ahorros.controller';
import { AhorrosService } from './ahorros.service';

describe('AhorrosController', () => {
  let controller: AhorrosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AhorrosController],
      providers: [AhorrosService],
    }).compile();

    controller = module.get<AhorrosController>(AhorrosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
