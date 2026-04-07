import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { DepartmentsModule } from '../departments/departments.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  imports: [PrismaModule, forwardRef(() => DepartmentsModule)],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
