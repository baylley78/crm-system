import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { DepartmentsModule } from '../departments/departments.module'
import { TrafficStatsController } from './traffic-stats.controller'
import { TrafficStatsService } from './traffic-stats.service'

@Module({
  imports: [PrismaModule, AuthModule, DepartmentsModule],
  controllers: [TrafficStatsController],
  providers: [TrafficStatsService],
})
export class TrafficStatsModule {}
