import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FirstSalesModule } from './modules/first-sales/first-sales.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuthModule } from './modules/auth/auth.module';
import { SecondSalesModule } from './modules/second-sales/second-sales.module';
import { LegalModule } from './modules/legal/legal.module';
import { MediationModule } from './modules/mediation/mediation.module';
import { ThirdSalesModule } from './modules/third-sales/third-sales.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { QualityModule } from './modules/quality/quality.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PaymentAccountsModule } from './modules/payment-accounts/payment-accounts.module';
import { CourtConfigModule } from './modules/court-config/court-config.module';
import { DingTalkReportModule } from './modules/dingtalk-report/dingtalk-report.module';
import { FilesModule } from './modules/files/files.module';
import { RefundModule } from './modules/refund/refund.module';
import { JudicialComplaintsModule } from './modules/judicial-complaints/judicial-complaints.module';
import { TrafficStatsModule } from './modules/traffic-stats/traffic-stats.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 120,
        },
        {
          name: 'login',
          ttl: 60000,
          limit: 5,
        },
      ],
    }),
    PrismaModule,
    CustomersModule,
    FirstSalesModule,
    DashboardModule,
    AuthModule,
    SecondSalesModule,
    LegalModule,
    MediationModule,
    ThirdSalesModule,
    ReportsModule,
    ApprovalsModule,
    QualityModule,
    ContractsModule,
    DepartmentsModule,
    PaymentAccountsModule,
    CourtConfigModule,
    DingTalkReportModule,
    FilesModule,
    RefundModule,
    JudicialComplaintsModule,
    TrafficStatsModule,
  ],
})
export class AppModule {}
