import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { DepartmentsModule } from '../departments/departments.module'
import { InvalidLeadsController } from './invalid-leads.controller'
import { InvalidLeadsService } from './invalid-leads.service'

@Module({
  imports: [PrismaModule, AuthModule, DepartmentsModule],
  controllers: [InvalidLeadsController],
  providers: [InvalidLeadsService],
})
export class InvalidLeadsModule {}
