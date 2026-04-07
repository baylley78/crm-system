import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { LegalService } from './legal.service'
import { SaveLegalCaseDto } from './dto/save-legal-case.dto'
import { TransferToThirdSalesDto } from './dto/transfer-to-third-sales.dto'
import { QueryLegalCasesDto } from './dto/query-legal-cases.dto'

@Controller('legal')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('legal.view')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('cases')
  findCases(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryLegalCasesDto) {
    return this.legalService.findCases(currentUser, query)
  }

  @Get('users')
  @RequirePermission('legal.users.view')
  findUsers() {
    return this.legalService.findUsers()
  }

  @Post('cases')
  @RequirePermission('legal.edit')
  saveCase(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: SaveLegalCaseDto) {
    return this.legalService.saveCase(currentUser, dto)
  }

  @Post('cases/transfer-to-third-sales')
  @RequirePermission('legal.transfer')
  transferToThirdSales(@Body() dto: TransferToThirdSalesDto) {
    return this.legalService.transferToThirdSales(dto)
  }
}
