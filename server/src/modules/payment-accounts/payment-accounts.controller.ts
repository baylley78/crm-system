import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import { PaymentAccountsService } from './payment-accounts.service'
import { SavePaymentAccountDto } from './dto/save-payment-account.dto'

@Controller('payment-accounts')
@UseGuards(CurrentUserGuard, PermissionGuard)
export class PaymentAccountsController {
  constructor(private readonly paymentAccountsService: PaymentAccountsService) {}

  @Get('options')
  findEnabledOptions() {
    return this.paymentAccountsService.findEnabledOptions()
  }

  @Get()
  @RequirePermission('system.paymentAccounts.manage')
  findAll() {
    return this.paymentAccountsService.findAll()
  }

  @Post()
  @RequirePermission('system.paymentAccounts.manage')
  create(@Body() dto: SavePaymentAccountDto) {
    return this.paymentAccountsService.create(dto)
  }

  @Patch(':id')
  @RequirePermission('system.paymentAccounts.manage')
  update(@Param('id') id: string, @Body() dto: SavePaymentAccountDto) {
    return this.paymentAccountsService.update(Number(id), dto)
  }
}
