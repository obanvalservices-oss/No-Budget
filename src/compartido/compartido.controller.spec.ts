import { Test, TestingModule } from '@nestjs/testing';
import { CompartidoController } from './compartido.controller';

describe('CompartidoController', () => {
  let controller: CompartidoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompartidoController],
    }).compile();

    controller = module.get<CompartidoController>(CompartidoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
