import { Test, TestingModule } from '@nestjs/testing';
import { CompartidoService } from './compartido.service';

describe('CompartidoService', () => {
  let service: CompartidoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompartidoService],
    }).compile();

    service = module.get<CompartidoService>(CompartidoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
