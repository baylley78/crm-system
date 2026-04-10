import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { DepartmentsModule } from '../departments/departments.module'
import { PaymentAccountsModule } from '../payment-accounts/payment-accounts.module'
import { CourtConfigModule } from '../court-config/court-config.module'
import { DingTalkReportModule } from '../dingtalk-report/dingtalk-report.module'
import { FilesModule } from '../files/files.module'
import { PaymentSerialValidatorService } from '../../common/services/payment-serial-validator.service'
import { ThirdSalesController } from './third-sales.controller'
import { ThirdSalesService } from './third-sales.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, DepartmentsModule, PaymentAccountsModule, CourtConfigModule, DingTalkReportModule, FilesModule],
  controllers: [ThirdSalesController],
  providers: [ThirdSalesService, PaymentSerialValidatorService],
})
export class ThirdSalesModule {}
