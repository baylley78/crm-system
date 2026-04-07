import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CourtConfigController } from './court-config.controller'
import { CourtConfigService } from './court-config.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CourtConfigController],
  providers: [CourtConfigService],
  exports: [CourtConfigService],
})
export class CourtConfigModule {}
