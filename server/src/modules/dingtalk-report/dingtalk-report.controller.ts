import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import { CreateDingTalkReportConfigDto } from './dto/create-dingtalk-report-config.dto'
import { UpdateDingTalkReportConfigDto } from './dto/update-dingtalk-report-config.dto'
import { DingTalkReportService } from './dingtalk-report.service'

@Controller('dingtalk-report-configs')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('system.dingTalkReports.manage')
export class DingTalkReportController {
  constructor(private readonly dingTalkReportService: DingTalkReportService) {}

  @Get()
  findAll() {
    return this.dingTalkReportService.findAll()
  }

  @Post()
  create(@Body() dto: CreateDingTalkReportConfigDto) {
    return this.dingTalkReportService.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDingTalkReportConfigDto) {
    return this.dingTalkReportService.update(Number(id), dto)
  }
}
