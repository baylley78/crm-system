import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { DashboardModule } from '../dashboard/dashboard.module'
import { DepartmentsModule } from '../departments/departments.module'
import { PaymentAccountsModule } from '../payment-accounts/payment-accounts.module'
import { CourtConfigModule } from '../court-config/court-config.module'
import { DingTalkReportModule } from '../dingtalk-report/dingtalk-report.module'
import { FilesModule } from '../files/files.module'
import { SecondSalesController } from './second-sales.controller'
import { SecondSalesService } from './second-sales.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, DashboardModule, DepartmentsModule, PaymentAccountsModule, CourtConfigModule, DingTalkReportModule, FilesModule],
  controllers: [SecondSalesController],
  providers: [SecondSalesService],
})
export class SecondSalesModule {}
