import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { ReportsService } from './reports.service'

@Controller('reports')
@UseGuards(CurrentUserGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @RequirePermission('reports.firstSales.view')
  getSummary(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getSummary(currentUser, { startDate, endDate, departmentId })
  }

  @Get('departments')
  @RequirePermission('reports.firstSales.view')
  getDepartments(@CurrentUser() currentUser: AuthenticatedUser, @Query('stage') stage: 'first-sales' | 'second-sales' | 'third-sales') {
    return this.reportsService.getDepartmentOptions(currentUser, stage)
  }

  @Get('first-sales/personal')
  @RequirePermission('reports.firstSales.view')
  getFirstSalesPersonal(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getFirstSalesPersonal(currentUser, { startDate, endDate, departmentId })
  }

  @Get('first-sales/team')
  @RequirePermission('reports.firstSales.teamView')
  getFirstSalesTeam(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getFirstSalesTeam(currentUser, { startDate, endDate, departmentId })
  }

  @Get('second-sales/personal')
  @RequirePermission('reports.secondSales.view')
  getSecondSalesPersonal(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getSecondSalesPersonal(currentUser, { startDate, endDate, departmentId })
  }

  @Get('second-sales/team')
  @RequirePermission('reports.secondSales.teamView')
  getSecondSalesTeam(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getSecondSalesTeam(currentUser, { startDate, endDate, departmentId })
  }

  @Get('third-sales/personal')
  @RequirePermission('reports.thirdSales.view')
  getThirdSalesPersonal(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getThirdSalesPersonal(currentUser, { startDate, endDate, departmentId })
  }

  @Get('third-sales/team')
  @RequirePermission('reports.thirdSales.teamView')
  getThirdSalesTeam(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reportsService.getThirdSalesTeam(currentUser, { startDate, endDate, departmentId })
  }
}
