import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { RefundService } from './refund.service'
import { QueryRefundCasesDto } from './dto/query-refund-cases.dto'
import { CreateRefundCaseDto } from './dto/create-refund-case.dto'
import { ReviewRefundCaseDto } from './dto/review-refund-case.dto'
import { AssignRefundCaseDto } from './dto/assign-refund-case.dto'
import { FollowRefundCaseDto } from './dto/follow-refund-case.dto'
import { CloseRefundCaseDto } from './dto/close-refund-case.dto'
import { UpdateRefundFirstSalesDepartmentDto } from './dto/update-refund-first-sales-department.dto'

@Controller('refund')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('refund.view')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Get('cases')
  findCases(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryRefundCasesDto) {
    return this.refundService.findCases(currentUser, query)
  }

  @Get('cases/:id')
  findCaseDetail(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.refundService.findCaseDetail(currentUser, Number(id))
  }

  @Get('users')
  findUsers() {
    return this.refundService.findUsers()
  }

  @Get('first-sales-departments')
  findFirstSalesDepartments(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.refundService.findFirstSalesDepartments(currentUser)
  }

  @Post('cases')
  @RequirePermission('refund.create')
  createCase(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: CreateRefundCaseDto) {
    return this.refundService.createCase(currentUser, dto)
  }

  @Patch('cases/:id/first-sales-department')
  @RequirePermission('refund.department.edit')
  updateFirstSalesDepartment(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRefundFirstSalesDepartmentDto) {
    return this.refundService.updateFirstSalesDepartment(currentUser, Number(id), dto)
  }

  @Post('cases/:id/review')
  @RequirePermission('refund.review')
  reviewCase(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewRefundCaseDto) {
    return this.refundService.reviewCase(currentUser, Number(id), dto)
  }

  @Post('cases/:id/assign')
  @RequirePermission('refund.assign')
  assignCase(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignRefundCaseDto) {
    return this.refundService.assignCase(currentUser, Number(id), dto)
  }

  @Post('cases/:id/follow')
  @RequirePermission('refund.edit')
  followCase(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: FollowRefundCaseDto) {
    return this.refundService.followCase(currentUser, Number(id), dto)
  }

  @Post('cases/:id/close')
  @RequirePermission('refund.close')
  closeCase(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloseRefundCaseDto) {
    return this.refundService.closeCase(currentUser, Number(id), dto)
  }

  @Delete('cases/:id')
  @RequirePermission('refund.delete')
  removeCase(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.refundService.removeCase(currentUser, Number(id))
  }
}
