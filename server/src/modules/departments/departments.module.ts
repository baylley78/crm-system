import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { DepartmentsController } from './departments.controller'
import { DepartmentsService } from './departments.service'

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
