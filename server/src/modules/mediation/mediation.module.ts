import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { FilesModule } from '../files/files.module'
import { MediationController } from './mediation.controller'
import { MediationService } from './mediation.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, FilesModule],
  controllers: [MediationController],
  providers: [MediationService],
})
export class MediationModule {}
