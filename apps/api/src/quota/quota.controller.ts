import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { QuotaService } from './quota.service';

@Controller('quota')
@UseGuards(AuthGuard)
export class QuotaController {
  constructor(private readonly quota: QuotaService) {}

  @Get()
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.quota.summary(user.id);
  }

  @Get('ledger')
  ledger(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    return this.quota.ledger(user.id, query);
  }
}
