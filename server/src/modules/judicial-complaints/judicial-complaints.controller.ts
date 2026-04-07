import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { JudicialComplaintsService } from './judicial-complaints.service'
import { CreateJudicialComplaintDto } from './dto/create-judicial-complaint.dto'
import { QueryJudicialComplaintsDto } from './dto/query-judicial-complaints.dto'
import { SearchJudicialComplaintCustomerDto } from './dto/search-judicial-complaint-customer.dto'

@Controller('judicial-complaints')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('judicialComplaint.view')
export class JudicialComplaintsController {
  constructor(private readonly judicialComplaintsService: JudicialComplaintsService) {}

  @Get('cases')
  findCases(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryJudicialComplaintsDto) {
    return this.judicialComplaintsService.findCases(currentUser, query)
  }

  @Get('cases/:id')
  findCaseDetail(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.judicialComplaintsService.findCaseDetail(currentUser, Number(id))
  }

  @Post('customers/search')
  @RequirePermission('judicialComplaint.create')
  searchCustomer(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: SearchJudicialComplaintCustomerDto) {
    return this.judicialComplaintsService.searchCustomer(currentUser, dto)
  }

  @Post('cases')
  @RequirePermission('judicialComplaint.create')
  createCase(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: CreateJudicialComplaintDto) {
    return this.judicialComplaintsService.createCase(currentUser, dto)
  }
}
