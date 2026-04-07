import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { ApprovalsService } from './approvals.service'
import { CreateApprovalDto } from './dto/create-approval.dto'
import { ApprovalActionDto } from './dto/approval-action.dto'
import { QueryApprovalsDto } from './dto/query-approvals.dto'
import { ApprovalPayDto } from './dto/approval-pay.dto'

@Controller('approvals')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('oa.approvals.view')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryApprovalsDto) {
    return this.approvalsService.findAll(currentUser, query)
  }

  @Post()
  @RequirePermission('oa.approvals.create')
  create(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: CreateApprovalDto) {
    return this.approvalsService.create(currentUser, dto)
  }

  @Post(':id/action')
  @RequirePermission('oa.approvals.review')
  action(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser, @Body() dto: ApprovalActionDto) {
    return this.approvalsService.action(Number(id), currentUser, dto)
  }

  @Post(':id/pay')
  @RequirePermission('oa.approvals.pay')
  pay(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser, @Body() dto: ApprovalPayDto) {
    return this.approvalsService.pay(Number(id), currentUser, dto)
  }
}
