import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { DingTalkReportController } from './dingtalk-report.controller'
import { DingTalkReportService } from './dingtalk-report.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DingTalkReportController],
  providers: [DingTalkReportService],
  exports: [DingTalkReportService],
})
export class DingTalkReportModule {}
