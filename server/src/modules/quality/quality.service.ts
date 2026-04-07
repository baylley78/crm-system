import { DataScope, Prisma } from '@prisma/client'
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { FilesService } from '../files/files.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CreateQualityRecordDto } from './dto/create-quality-record.dto'

@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
    private readonly filesService: FilesService,
  ) {}

  async findRecords(currentUser: AuthenticatedUser, responsibleId?: number) {
    const baseWhere = await this.buildVisibilityWhere(currentUser)
    const where: Prisma.QualityRecordWhereInput = {
      ...baseWhere,
      ...(responsibleId ? { responsibleId } : {}),
    }

    const records = await this.prisma.qualityRecord.findMany({
      where,
      include: {
        responsible: true,
      },
      orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
    })

    return records.map((item) => ({
      id: item.id,
      recordDate: item.recordDate,
      responsibleId: item.responsibleId,
      responsibleName: item.responsible.realName,
      penaltyAmount: Number(item.penaltyAmount ?? 0),
      matter: item.matter,
      screenshotUrl: this.filesService.toAccessUrl(item.screenshotUrl),
      createdAt: item.createdAt,
    }))
  }

  async findResponsibles(currentUser: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: await this.buildResponsibleWhere(currentUser),
      select: {
        id: true,
        realName: true,
      },
      orderBy: [{ realName: 'asc' }, { id: 'asc' }],
    })

    return users.map((item) => ({
      id: item.id,
      name: item.realName,
    }))
  }

  async createRecord(
    currentUser: AuthenticatedUser,
    dto: CreateQualityRecordDto,
    files?: {
      screenshot?: Array<{ filename: string }>
    },
  ) {
    const responsible = await this.prisma.user.findUnique({ where: { id: dto.responsibleId } })
    if (!responsible) {
      throw new NotFoundException('责任人不存在')
    }

    await this.ensureCanAccessResponsible(currentUser, responsible)

    const record = await this.prisma.qualityRecord.create({
      data: {
        recordDate: new Date(dto.recordDate),
        responsibleId: dto.responsibleId,
        matter: dto.matter,
        penaltyAmount: dto.penaltyAmount,
        screenshotUrl: files?.screenshot?.[0] ? `/uploads/${files.screenshot[0].filename}` : undefined,
      },
      include: {
        responsible: true,
      },
    })

    return {
      id: record.id,
      recordDate: record.recordDate,
      responsibleId: record.responsibleId,
      responsibleName: record.responsible.realName,
      penaltyAmount: Number(record.penaltyAmount ?? 0),
      matter: record.matter,
      screenshotUrl: this.filesService.toAccessUrl(record.screenshotUrl),
      createdAt: record.createdAt,
    }
  }

  private async buildResponsibleWhere(currentUser: AuthenticatedUser): Promise<Prisma.UserWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return {}
      case DataScope.SELF:
        return { id: currentUser.id }
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return { departmentId: currentUser.departmentId }
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          departmentId: {
            in: await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId),
          },
        }
      default:
        return { id: -1 }
    }
  }

  private async ensureCanAccessResponsible(currentUser: AuthenticatedUser, responsible: { id: number; departmentId: number | null }) {
    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return
      case DataScope.SELF:
        if (responsible.id !== currentUser.id) {
          throw new ForbiddenException('无权为该责任人新增质检记录')
        }
        return
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId || responsible.departmentId !== currentUser.departmentId) {
          throw new ForbiddenException('无权为该责任人新增质检记录')
        }
        return
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId || !responsible.departmentId) {
          throw new ForbiddenException('无权为该责任人新增质检记录')
        }
        if (!(await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId)).includes(responsible.departmentId)) {
          throw new ForbiddenException('无权为该责任人新增质检记录')
        }
        return
      default:
        throw new ForbiddenException('无权为该责任人新增质检记录')
    }
  }

  private async buildVisibilityWhere(currentUser: AuthenticatedUser): Promise<Prisma.QualityRecordWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return {}
      case DataScope.SELF:
        return { responsibleId: currentUser.id }
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          responsible: {
            departmentId: currentUser.departmentId,
          },
        }
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          responsible: {
            departmentId: {
              in: await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId),
            },
          },
        }
      default:
        return { id: -1 }
    }
  }
}
