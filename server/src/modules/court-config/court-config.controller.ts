import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import { CourtConfigService } from './court-config.service'
import { SaveCourtConfigDto } from './dto/save-court-config.dto'

@Controller('court-config')
@UseGuards(CurrentUserGuard, PermissionGuard)
export class CourtConfigController {
  constructor(private readonly courtConfigService: CourtConfigService) {}

  @Get()
  @RequirePermission('system.courtConfig.view')
  getConfig() {
    return this.courtConfigService.getConfig()
  }

  @Put()
  @RequirePermission('system.courtConfig.manage')
  saveConfig(@Body() dto: SaveCourtConfigDto) {
    return this.courtConfigService.saveConfig(dto)
  }
}
