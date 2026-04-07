import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { DepartmentsModule } from '../departments/departments.module'
import { RefundController } from './refund.controller'
import { RefundService } from './refund.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, DepartmentsModule],
  controllers: [RefundController],
  providers: [RefundService],
})
export class RefundModule {}
