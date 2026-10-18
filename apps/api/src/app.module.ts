import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { validateEnvironment } from './config/env';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SystemModule } from './system/system.module';
import { AuthModule } from './auth/auth.module';
import { BodyProfilesModule } from './body-profiles/body-profiles.module';
import { GenerationsModule } from './generations/generations.module';
import { WardrobeModule } from './wardrobe/wardrobe.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      cache: true,
      validate: validateEnvironment,
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '1h', issuer: 'lumi-api', audience: 'lumi-miniapp' },
        verifyOptions: { issuer: 'lumi-api', audience: 'lumi-miniapp' },
      }),
    }),
    PrismaModule,
    HealthModule,
    SystemModule,
    AuthModule,
    BodyProfilesModule,
    GenerationsModule,
    WardrobeModule,
  ],
})
export class AppModule {}
