import { Test, TestingModule } from '@nestjs/testing';
import { InversionesController } from './inversiones.controller';
import { InversionesService } from './inversiones.service';

describe('InversionesController', () => {
  let controller: InversionesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InversionesController],
      providers: [InversionesService],
    }).compile();

    controller = module.get<InversionesController>(InversionesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
