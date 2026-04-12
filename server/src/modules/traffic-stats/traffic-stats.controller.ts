import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { SaveTrafficStatDto } from './dto/save-traffic-stat.dto'
import { TrafficStatsQueryDto } from './dto/traffic-stats-query.dto'
import { TrafficStatsService } from './traffic-stats.service'

@Controller('traffic-stats')
@UseGuards(CurrentUserGuard, PermissionGuard)
export class TrafficStatsController {
  constructor(private readonly trafficStatsService: TrafficStatsService) {}

  @Get('me')
  @RequirePermission('trafficStats.submit')
  getMyDailyStat(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('date') date?: string,
  ) {
    return this.trafficStatsService.getMyDailyStat(currentUser, date)
  }

  @Post('me')
  @RequirePermission('trafficStats.submit')
  saveMyDailyStat(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: SaveTrafficStatDto,
  ) {
    return this.trafficStatsService.saveMyDailyStat(currentUser, dto)
  }

  @Get()
  @RequirePermission('trafficStats.view')
  findRows(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: TrafficStatsQueryDto,
  ) {
    return this.trafficStatsService.findRows(currentUser, query)
  }

  @Get('summary')
  @RequirePermission('trafficStats.view')
  getSummary(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: TrafficStatsQueryDto,
  ) {
    return this.trafficStatsService.getSummary(currentUser, query)
  }

  @Get('departments')
  @RequirePermission('trafficStats.view')
  async getDepartments(@CurrentUser() currentUser: AuthenticatedUser) {
    const options = await this.trafficStatsService.getDepartmentOptions(currentUser)
    return { options }
  }

  @Delete(':id')
  @RequirePermission('trafficStats.delete')
  deleteTrafficStat(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.trafficStatsService.deleteTrafficStat(currentUser, id)
  }
}
