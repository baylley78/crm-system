import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { DepartmentsModule } from '../departments/departments.module'
import { FilesModule } from '../files/files.module'
import { QualityController } from './quality.controller'
import { QualityService } from './quality.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, DepartmentsModule, FilesModule],
  controllers: [QualityController],
  providers: [QualityService],
})
export class QualityModule {}
