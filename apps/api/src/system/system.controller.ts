import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('system')
export class SystemController {
  constructor(private readonly config: ConfigService) {}

  @Get('bootstrap')
  getBootstrap() {
    return {
      freeMode: this.config.getOrThrow<string>('FREE_MODE') === 'true',
      media: {
        uploadMode:
          this.config.getOrThrow<string>('MEDIA_STORAGE_DRIVER') === 's3' ? 'signed-post' : 'development-base64',
        maxBytes: 5 * 1024 * 1024,
      },
      features: {
        generation: true,
        payments: false,
        community: true,
        follows: false,
      },
    };
  }
}
