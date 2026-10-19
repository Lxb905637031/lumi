import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  Max,
  MinLength,
  validateSync,
} from 'class-validator';

class Environment {
  @IsOptional()
  @IsString()
  NODE_ENV = 'development';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  PORT = 4300;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  REDIS_URL = 'redis://127.0.0.1:56379';

  @IsOptional()
  @IsString()
  CORS_ORIGINS = '';

  @IsOptional()
  @IsBooleanString()
  FREE_MODE = 'true';

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:[1-9]|[1-5][0-9]|60)m$/)
  JWT_ACCESS_TTL = '15m';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  REFRESH_TOKEN_TTL_DAYS = 30;

  @IsOptional()
  @IsString()
  WECHAT_APP_ID?: string;

  @IsOptional()
  @IsString()
  WECHAT_APP_SECRET?: string;

  @IsOptional()
  @IsString()
  LOCAL_ADMIN_OPEN_IDS = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  GENERATION_QUEUE_ATTEMPTS = 3;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(60_000)
  GENERATION_QUEUE_BACKOFF_MS = 1_000;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = plainToInstance(Environment, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(environment, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }
  if (environment.FREE_MODE !== 'true' && (!environment.WECHAT_APP_ID || !environment.WECHAT_APP_SECRET)) {
    throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET are required when FREE_MODE is disabled');
  }
  if (environment.NODE_ENV === 'production' && environment.FREE_MODE === 'true') {
    throw new Error('FREE_MODE must be disabled in production');
  }
  if (environment.NODE_ENV === 'production' && !environment.CORS_ORIGINS.trim()) {
    throw new Error('CORS_ORIGINS must be configured in production');
  }
  if (environment.NODE_ENV === 'production' && environment.LOCAL_ADMIN_OPEN_IDS.trim()) {
    throw new Error('LOCAL_ADMIN_OPEN_IDS is only allowed outside production');
  }
  return environment;
}
