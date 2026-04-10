import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { DepartmentsModule } from '../departments/departments.module'
import { PaymentAccountsModule } from '../payment-accounts/payment-accounts.module'
import { DingTalkReportModule } from '../dingtalk-report/dingtalk-report.module'
import { FilesModule } from '../files/files.module'
import { PaymentSerialValidatorService } from '../../common/services/payment-serial-validator.service'
import { FirstSalesController } from './first-sales.controller'
import { FirstSalesService } from './first-sales.service'

@Module({
  imports: [PrismaModule, AuthModule, DepartmentsModule, PaymentAccountsModule, DingTalkReportModule, FilesModule],
  controllers: [FirstSalesController],
  providers: [FirstSalesService, PaymentSerialValidatorService],
})
export class FirstSalesModule {}
