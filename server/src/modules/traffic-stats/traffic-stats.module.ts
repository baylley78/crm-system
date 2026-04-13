import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { DepartmentsModule } from '../departments/departments.module'
import { DingTalkReportModule } from '../dingtalk-report/dingtalk-report.module'
import { TrafficStatsController } from './traffic-stats.controller'
import { TrafficStatsService } from './traffic-stats.service'

@Module({
  imports: [PrismaModule, AuthModule, DepartmentsModule, DingTalkReportModule],
  controllers: [TrafficStatsController],
  providers: [TrafficStatsService],
})
export class TrafficStatsModule {}
