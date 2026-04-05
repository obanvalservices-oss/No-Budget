import { Test, TestingModule } from '@nestjs/testing';
import { InversionesService } from './inversiones.service';

describe('InversionesService', () => {
  let service: InversionesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InversionesService],
    }).compile();

    service = module.get<InversionesService>(InversionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
