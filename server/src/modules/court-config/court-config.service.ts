import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { SaveCourtConfigDto } from './dto/save-court-config.dto'

@Injectable()
export class CourtConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    const config = await this.ensureConfig()
    return this.mapConfig(config)
  }

  async saveConfig(dto: SaveCourtConfigDto) {
    const existing = await this.prisma.courtConfig.findFirst({ orderBy: { id: 'asc' } })
    const config = existing
      ? await this.prisma.courtConfig.update({
          where: { id: existing.id },
          data: {
            hearingCost: dto.hearingCost,
            remark: dto.remark?.trim(),
          },
        })
      : await this.prisma.courtConfig.create({
          data: {
            hearingCost: dto.hearingCost,
            remark: dto.remark?.trim(),
          },
        })

    return this.mapConfig(config)
  }

  async getHearingCost() {
    const config = await this.ensureConfig()
    return Number(config.hearingCost ?? 0)
  }

  private async ensureConfig() {
    const existing = await this.prisma.courtConfig.findFirst({ orderBy: { id: 'asc' } })
    if (existing) {
      return existing
    }

    return this.prisma.courtConfig.create({
      data: {
        hearingCost: 0,
      },
    })
  }

  private mapConfig(config: { id: number; hearingCost: unknown; remark: string | null; updatedAt: Date; createdAt: Date }) {
    return {
      id: config.id,
      hearingCost: Number(config.hearingCost ?? 0),
      remark: config.remark || '',
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }
}
