import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { InvalidLeadsQueryDto } from './dto/invalid-leads-query.dto'
import { SaveInvalidLeadDto } from './dto/save-invalid-lead.dto'
import { InvalidLeadsService } from './invalid-leads.service'

@Controller('invalid-leads')
@UseGuards(CurrentUserGuard, PermissionGuard)
export class InvalidLeadsController {
  constructor(private readonly invalidLeadsService: InvalidLeadsService) {}

  @Get()
  @RequirePermission('invalidLeads.view')
  findRows(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: InvalidLeadsQueryDto,
  ) {
    return this.invalidLeadsService.findRows(currentUser, query)
  }

  @Get('departments')
  @RequirePermission('invalidLeads.view')
  async getDepartments(@CurrentUser() currentUser: AuthenticatedUser) {
    const options = await this.invalidLeadsService.getDepartmentOptions(currentUser)
    return { options }
  }

  @Post()
  @RequirePermission('invalidLeads.submit')
  save(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: SaveInvalidLeadDto,
  ) {
    return this.invalidLeadsService.save(currentUser, dto)
  }
}
