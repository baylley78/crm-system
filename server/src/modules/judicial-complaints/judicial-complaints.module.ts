import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { FilesModule } from '../files/files.module'
import { JudicialComplaintsController } from './judicial-complaints.controller'
import { JudicialComplaintsService } from './judicial-complaints.service'

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, FilesModule],
  controllers: [JudicialComplaintsController],
  providers: [JudicialComplaintsService],
})
export class JudicialComplaintsModule {}
