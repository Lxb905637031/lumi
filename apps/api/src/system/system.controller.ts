import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('system')
export class SystemController {
  constructor(private readonly config: ConfigService) {}

  @Get('bootstrap')
  getBootstrap() {
    return {
      freeMode: this.config.getOrThrow<string>('FREE_MODE') === 'true',
      features: {
        generation: true,
        payments: false,
        community: true,
        follows: false,
      },
    };
  }
}
