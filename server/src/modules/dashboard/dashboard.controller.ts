import { Controller, Get, UseGuards } from '@nestjs/common'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('dashboard.view')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary()
  }
}
