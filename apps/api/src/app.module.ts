import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { ModerationModule } from './moderation/moderation.module';
import { MediaModule } from './media/media.module';
import { CommunityModule } from './community/community.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { AccountPrivacyModule } from './account-privacy/account-privacy.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { UserModerationModule } from './user-moderation/user-moderation.module';
import { ChallengesModule } from './challenges/challenges.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('JWT_ACCESS_TTL'),
          issuer: 'lumi-api',
          audience: 'lumi-miniapp',
        },
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
    ModerationModule,
    MediaModule,
    CommunityModule,
    NotificationsModule,
    OperationsModule,
    AccountPrivacyModule,
    AnnouncementsModule,
    UserModerationModule,
    ChallengesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
