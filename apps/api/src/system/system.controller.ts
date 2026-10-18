import { Controller, Get } from '@nestjs/common';

@Controller('system')
export class SystemController {
  @Get('bootstrap')
  getBootstrap() {
    return {
      freeMode: true,
      features: {
        generation: true,
        payments: false,
        community: true,
        follows: false,
      },
    };
  }
}
