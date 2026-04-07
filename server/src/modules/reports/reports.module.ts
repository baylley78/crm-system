import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { DepartmentsModule } from '../departments/departments.module'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'

@Module({
  imports: [PrismaModule, AuthModule, DepartmentsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
