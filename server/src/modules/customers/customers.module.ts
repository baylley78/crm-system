import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { DepartmentsModule } from '../departments/departments.module'
import { AuthModule } from '../auth/auth.module'
import { FilesModule } from '../files/files.module'
import { CustomersController } from './customers.controller'
import { CustomersService } from './customers.service'

@Module({
  imports: [PrismaModule, AuthModule, DepartmentsModule, forwardRef(() => FilesModule)],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
