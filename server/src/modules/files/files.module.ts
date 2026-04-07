import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CustomersModule } from '../customers/customers.module'
import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => CustomersModule)],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
