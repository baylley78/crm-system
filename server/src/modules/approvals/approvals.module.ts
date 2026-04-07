import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { DepartmentsModule } from '../departments/departments.module'
import { ApprovalsController } from './approvals.controller'
import { ApprovalsService } from './approvals.service'

@Module({
  imports: [PrismaModule, AuthModule, DepartmentsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
