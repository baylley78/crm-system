import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { FilesModule } from '../files/files.module'
import { LegalController } from './legal.controller'
import { LegalService } from './legal.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, FilesModule],
  controllers: [LegalController],
  providers: [LegalService],
})
export class LegalModule {}
