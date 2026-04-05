import { Test, TestingModule } from '@nestjs/testing';
import { AhorrosService } from './ahorros.service';

describe('AhorrosService', () => {
  let service: AhorrosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AhorrosService],
    }).compile();

    service = module.get<AhorrosService>(AhorrosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
