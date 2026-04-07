import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { FilesModule } from '../files/files.module'
import { ContractsController } from './contracts.controller'
import { ContractsService } from './contracts.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, FilesModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
