import { plainToInstance } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString, validateSync } from 'class-validator';

class Environment {
  @IsOptional()
  @IsString()
  NODE_ENV = 'development';

  @IsOptional()
  @IsInt()
  PORT = 4300;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  REDIS_URL = 'redis://127.0.0.1:56379';

  @IsOptional()
  @IsBooleanString()
  FREE_MODE = 'true';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = plainToInstance(Environment, config, { enableImplicitConversion: true });
  const errors = validateSync(environment, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }
  return environment;
}
