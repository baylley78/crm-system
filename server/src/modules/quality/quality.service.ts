import { DataScope, JudicialComplaintHandlingStatus, Prisma } from '@prisma/client'
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { FilesService } from '../files/files.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { CreateQualityRecordDto } from './dto/create-quality-record.dto'

@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
    private readonly filesService: FilesService,
    private readonly customersService: CustomersService,
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
        customer: true,
        complaintCases: {
          include: {
            handledBy: true,
          },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
    })

    return records.map((item) => this.mapRecord(item))
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

    const customer = dto.customerId
      ? await this.prisma.customer.findFirst({
          where: {
            id: dto.customerId,
            ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
          },
          select: {
            id: true,
            name: true,
            phone: true,
          },
        })
      : null

    if (dto.customerId && !customer) {
      throw new NotFoundException('客户不存在或无权访问')
    }

    const complaintCase = dto.judicialComplaintCaseId
      ? await this.prisma.judicialComplaintCase.findFirst({
          where: {
            id: dto.judicialComplaintCaseId,
            OR: [{ customer: await this.customersService.buildCustomerVisibilityWhere(currentUser) }, { customerId: null }],
          },
          select: {
            id: true,
            customerId: true,
            shouldHandle: true,
            handlingStatus: true,
          },
        })
      : null

    if (dto.judicialComplaintCaseId && !complaintCase) {
      throw new NotFoundException('司法投诉不存在或无权访问')
    }

    const resolvedCustomerId = dto.customerId ?? complaintCase?.customerId ?? undefined

    if (dto.customerId && complaintCase?.customerId && complaintCase.customerId !== dto.customerId) {
      throw new ForbiddenException('司法投诉与客户不匹配')
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.qualityRecord.create({
        data: {
          recordDate: new Date(dto.recordDate),
          responsibleId: dto.responsibleId,
          customerId: resolvedCustomerId,
          matter: dto.matter,
          penaltyAmount: dto.penaltyAmount,
          screenshotUrl: files?.screenshot?.[0] ? `/uploads/${files.screenshot[0].filename}` : undefined,
        },
        include: {
          responsible: true,
          customer: true,
        },
      })

      if (complaintCase) {
        await tx.judicialComplaintCase.update({
          where: { id: complaintCase.id },
          data: {
            qualityRecordId: created.id,
            qualityChecked: true,
            qualityCheckedAt: new Date(),
            handledById: currentUser.id,
            handledAt: complaintCase.shouldHandle ? new Date() : undefined,
            handlingStatus:
              complaintCase.shouldHandle && complaintCase.handlingStatus !== JudicialComplaintHandlingStatus.HANDLED
                ? JudicialComplaintHandlingStatus.HANDLED
                : undefined,
          },
        })
      }

      return tx.qualityRecord.findUnique({
        where: { id: created.id },
        include: {
          responsible: true,
          customer: true,
          complaintCases: {
            include: {
              handledBy: true,
            },
            orderBy: { id: 'desc' },
            take: 1,
          },
        },
      })
    })

    return this.mapRecord(record)
  }

  private mapRecord(item: any) {
    const complaintCase = item?.complaintCases?.[0]

    return {
      id: item.id,
      recordDate: item.recordDate,
      responsibleId: item.responsibleId,
      responsibleName: item.responsible.realName,
      customerId: item.customerId ?? undefined,
      customerName: item.customer?.name,
      customerPhone: item.customer?.phone,
      judicialComplaintCaseId: complaintCase?.id,
      judicialComplaintQualityCheckedAt: complaintCase?.qualityCheckedAt,
      judicialComplaintHandledByName: complaintCase?.handledBy?.realName,
      penaltyAmount: Number(item.penaltyAmount ?? 0),
      matter: item.matter,
      screenshotUrl: this.filesService.toAccessUrl(item.screenshotUrl),
      createdAt: item.createdAt,
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
