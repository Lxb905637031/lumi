import { plainToInstance, Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

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
  WECHAT_APP_ID?: string;

  @IsOptional()
  @IsString()
  WECHAT_APP_SECRET?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = plainToInstance(Environment, config, { enableImplicitConversion: true });
  const errors = validateSync(environment, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }
  if (environment.FREE_MODE !== 'true' && (!environment.WECHAT_APP_ID || !environment.WECHAT_APP_SECRET)) {
    throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET are required when FREE_MODE is disabled');
  }
  return environment;
}
