import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { CustomerStatus, FollowStage } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { FilesService } from '../files/files.service'
import { SaveMediationCaseDto } from './dto/save-mediation-case.dto'

const MEDIATION_ROLE_CODES = ['SUPER_ADMIN', 'AFTER_SALES_MANAGER', 'AFTER_SALES', 'MEDIATION_SPECIALIST', 'LEGAL_MANAGER', 'LEGAL', 'SECOND_SALES_MANAGER', 'SECOND_SALES_SUPERVISOR', 'SECOND_SALES']
const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MEDIATION_TIME_EDIT_PERMISSION = 'mediation.time.edit'

@Injectable()
export class MediationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly filesService: FilesService,
  ) {}

  async findCases(currentUser: AuthenticatedUser, query?: { page?: number; pageSize?: number }) {
    const page = query?.page ?? DEFAULT_PAGE
    const pageSize = query?.pageSize ?? DEFAULT_PAGE_SIZE
    const skip = (page - 1) * pageSize
    const where = {
      ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      currentStatus: {
        in: [CustomerStatus.PENDING_MEDIATION, CustomerStatus.MEDIATION_PROCESSING, CustomerStatus.MEDIATION_COMPLETED],
      },
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          firstSalesUser: true,
          secondSalesUser: true,
          mediationCases: {
            include: { owner: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ])

    return {
      items: customers.map((customer) => {
        const latestCase = customer.mediationCases[0]
        return {
          customerId: customer.id,
          customerNo: customer.customerNo,
          name: customer.name,
          phone: customer.phone,
          currentOwnerId: customer.currentOwnerId ?? undefined,
          firstSalesUserId: customer.firstSalesUserId ?? undefined,
          secondSalesUserId: customer.secondSalesUserId ?? undefined,
          legalUserId: customer.legalUserId ?? undefined,
          thirdSalesUserId: customer.thirdSalesUserId ?? undefined,
          currentStatus: this.mapCustomerStatus(customer.currentStatus),
          firstSalesUserName: customer.firstSalesUser?.realName,
          secondSalesUserName: customer.secondSalesUser?.realName,
          caseType: customer.caseType,
          source: customer.source,
          intentionLevel: customer.intentionLevel,
          firstPaymentAmount: Number(customer.firstPaymentAmount),
          secondPaymentAmount: Number(customer.secondPaymentAmount),
          arrearsAmount: Number(customer.arrearsAmount),
          ownerId: latestCase?.ownerId,
          ownerName: latestCase?.owner?.realName,
          progressStatus: latestCase?.progressStatus ?? (customer.currentStatus === CustomerStatus.PENDING_MEDIATION ? '待接手' : '调解处理中'),
          mediationResult: latestCase?.mediationResult ?? '',
          remark: latestCase?.remark ?? customer.remark ?? '',
          evidenceFileUrls: this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(latestCase?.evidenceFileUrls)),
          isCompleted: customer.currentStatus === CustomerStatus.MEDIATION_COMPLETED,
        }
      }),
      total,
      page,
      pageSize,
    }
  }

  async findUsers() {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { id: 'asc' },
    })

    return users
      .filter((user) => MEDIATION_ROLE_CODES.includes(user.role.code))
      .map((user) => ({
        id: user.id,
        realName: user.realName,
        roleName: user.role.name,
      }))
  }

  async saveCase(
    currentUser: AuthenticatedUser,
    dto: SaveMediationCaseDto,
    files?: {
      evidenceFiles?: Array<{ filename: string }>
    },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: { mediationCases: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (!customer) {
      throw new NotFoundException('客户不存在')
    }

    const owner = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!owner) {
      throw new NotFoundException('调解负责人不存在')
    }

    const evidenceFileUrls = files?.evidenceFiles?.length
      ? JSON.stringify(files.evidenceFiles.map((file) => `/uploads/${file.filename}`))
      : dto.evidenceFileUrls

    const latestCase = customer.mediationCases[0]
    const startDate = this.resolveStartDate(currentUser, dto.startDate, latestCase?.startDate)
    const followContent = this.buildFollowContent(dto)

    await this.prisma.$transaction(async (tx) => {
      if (latestCase) {
        await tx.mediationCase.update({
          where: { id: latestCase.id },
          data: {
            ownerId: currentUser.id,
            progressStatus: dto.progressStatus,
            mediationResult: dto.mediationResult,
            remark: dto.remark,
            evidenceFileUrls,
            startDate,
            finishDate: dto.isCompleted ? new Date() : null,
          },
        })
      } else {
        await tx.mediationCase.create({
          data: {
            customerId: dto.customerId,
            ownerId: currentUser.id,
            progressStatus: dto.progressStatus,
            mediationResult: dto.mediationResult,
            remark: dto.remark,
            evidenceFileUrls,
            startDate,
            finishDate: dto.isCompleted ? new Date() : null,
          },
        })
      }

      await tx.customerFollowLog.create({
        data: {
          customerId: dto.customerId,
          operatorId: currentUser.id,
          stage: FollowStage.MEDIATION,
          content: followContent,
        },
      })

      await tx.customer.update({
        where: { id: dto.customerId },
        data: {
          currentOwnerId: currentUser.id,
          currentStatus: dto.isCompleted ? CustomerStatus.MEDIATION_COMPLETED : CustomerStatus.MEDIATION_PROCESSING,
        },
      })
    })

    return { success: true }
  }

  private resolveStartDate(currentUser: AuthenticatedUser, input?: string, fallback?: Date | null) {
    if (!input) {
      return fallback ?? new Date()
    }

    if (!currentUser.permissions.includes(MEDIATION_TIME_EDIT_PERMISSION)) {
      return fallback ?? new Date()
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('调解开始时间格式不正确')
    }

    return parsed
  }

  private buildFollowContent(dto: SaveMediationCaseDto) {
    const parts = [
      dto.isCompleted ? '调解完结' : '调解跟进',
      dto.progressStatus?.trim() ? `进度：${dto.progressStatus.trim()}` : '',
      dto.mediationResult?.trim() ? `结果：${dto.mediationResult.trim()}` : '',
      dto.remark?.trim() ? `备注：${dto.remark.trim()}` : '',
    ].filter(Boolean)

    return parts.join('；')
  }

  private mapCustomerStatus(status: CustomerStatus) {
    const labels: Record<CustomerStatus, string> = {
      INITIAL: '初始建档',
      PENDING_TAIL_PAYMENT: '待补尾款',
      PENDING_SECOND_SALES_ASSIGNMENT: '待分配二销',
      SECOND_SALES_FOLLOWING: '二销跟进中',
      PENDING_LEGAL: '待转法务',
      LEGAL_PROCESSING: '法务处理中',
      PENDING_MEDIATION: '待转调解',
      PENDING_THIRD_SALES: '待转三销',
      THIRD_SALES_FOLLOWING: '三销开发中',
      COMPLETED_THIRD_SALES: '已完成三销',
      MEDIATION_PROCESSING: '调解处理中',
      MEDIATION_COMPLETED: '调解完成',
    }

    return labels[status]
  }
}
