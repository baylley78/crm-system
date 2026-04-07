import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { CustomerStatus, DataScope, FollowStage, Prisma } from '@prisma/client'
import { CustomerStatusLabel } from '../../common/enums/customer-status.enum'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { FilesService } from '../files/files.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { QueryCustomersDto } from './dto/query-customers.dto'
import { CreateCustomerFollowDto } from './dto/create-customer-follow.dto'
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
    @Inject(forwardRef(() => FilesService))
    private readonly filesService: FilesService,
  ) {}

  async findAll(currentUser: AuthenticatedUser, query: QueryCustomersDto) {
    const visibilityWhere = await this.buildCustomerVisibilityWhere(currentUser)
    const page = query.page ?? DEFAULT_PAGE
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
    const skip = (page - 1) * pageSize

    const where: Prisma.CustomerWhereInput = {
      ...visibilityWhere,
      ...(query.name
        ? {
            name: {
              contains: query.name,
            },
          }
        : {}),
      ...(query.phone
        ? {
            phone: {
              contains: query.phone,
            },
          }
        : {}),
      ...(query.wechat
        ? {
            wechat: {
              contains: query.wechat,
            },
          }
        : {}),
      ...(query.status
        ? {
            currentStatus: query.status as keyof typeof CustomerStatusLabel,
          }
        : {}),
      ...(query.source
        ? {
            source: {
              contains: query.source,
            },
          }
        : {}),
      ...(query.caseType
        ? {
            caseType: {
              contains: query.caseType,
            },
          }
        : {}),
      ...(query.intentionLevel
        ? {
            intentionLevel: {
              contains: query.intentionLevel,
            },
          }
        : {}),
      ...(query.isTailPaymentCompleted !== undefined
        ? {
            isTailPaymentCompleted: query.isTailPaymentCompleted === 'true',
          }
        : {}),
      ...(query.hasApprovalRecord === 'true'
        ? {
            approvals: {
              some: {},
            },
          }
        : {}),
      ...(query.hasApprovalRecord === 'false'
        ? {
            approvals: {
              none: {},
            },
          }
        : {}),
      ...(query.hasQualityRecord === 'true'
        ? {
            qualityRecords: {
              some: {},
            },
          }
        : {}),
      ...(query.hasQualityRecord === 'false'
        ? {
            qualityRecords: {
              none: {},
            },
          }
        : {}),
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          firstSalesUser: {
            include: {
              departmentInfo: {
                include: {
                  parent: true,
                },
              },
            },
          },
          secondSalesUser: true,
          legalUser: true,
          thirdSalesUser: true,
          followLogs: {
            include: { operator: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          approvals: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          qualityRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ])

    return {
      items: customers.map((customer) => this.toCustomerListItem(customer, currentUser)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(currentUser: AuthenticatedUser, id: number) {
    const customer = await this.getCustomerById(currentUser, id)

    return this.mapCustomerDetail(customer, currentUser)
  }

  async createFollow(currentUser: AuthenticatedUser, id: number, dto: CreateCustomerFollowDto) {
    const customer = await this.getCustomerById(currentUser, id)

    if (customer.currentOwnerId && customer.currentOwnerId !== currentUser.id) {
      throw new BadRequestException('当前客户不在你名下，无法跟进')
    }

    const operator = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!operator) {
      throw new NotFoundException('跟进人不存在')
    }

    await this.prisma.customerFollowLog.create({
      data: {
        customerId: id,
        operatorId: currentUser.id,
        stage: this.resolveFollowStage(customer.currentStatus),
        content: dto.content,
        nextFollowTime: dto.nextFollowTime ? new Date(dto.nextFollowTime) : undefined,
      },
    })

    return this.findOne(currentUser, id)
  }

  async updateStatus(currentUser: AuthenticatedUser, id: number, dto: UpdateCustomerStatusDto) {
    await this.getCustomerById(currentUser, id)

    await this.prisma.customer.update({
      where: { id },
      data: {
        currentStatus: dto.status as CustomerStatus,
      },
    })

    return this.findOne(currentUser, id)
  }

  async remove(currentUser: AuthenticatedUser, id: number) {
    await this.getCustomerById(currentUser, id)

    await this.prisma.$transaction(async (tx) => {
      await tx.customerFollowLog.deleteMany({ where: { customerId: id } })
      await tx.firstSalesOrder.deleteMany({ where: { customerId: id } })
      await tx.secondSalesOrder.deleteMany({ where: { customerId: id } })
      await tx.secondSalesAssignment.deleteMany({ where: { customerId: id } })
      await tx.legalCase.deleteMany({ where: { customerId: id } })
      await tx.mediationCase.deleteMany({ where: { customerId: id } })
      await tx.thirdSalesOrder.deleteMany({ where: { customerId: id } })
      await tx.refundCaseLog.deleteMany({ where: { refundCase: { customerId: id } } })
      await tx.refundCase.deleteMany({ where: { customerId: id } })
      await tx.approval.deleteMany({ where: { customerId: id } })
      await tx.qualityRecord.deleteMany({ where: { customerId: id } })
      await tx.customer.delete({ where: { id } })
    })

    return { success: true }
  }

  private async getCustomerById(currentUser: AuthenticatedUser, id: number) {
    const visibilityWhere = await this.buildCustomerVisibilityWhere(currentUser)

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        ...visibilityWhere,
      },
      include: {
        firstSalesUser: {
          include: {
            departmentInfo: {
              include: {
                parent: true,
              },
            },
          },
        },
        secondSalesUser: true,
        legalUser: true,
        thirdSalesUser: true,
        currentOwner: true,
        firstSalesOrders: {
          orderBy: { createdAt: 'desc' },
        },
        secondSalesOrders: {
          orderBy: { createdAt: 'desc' },
        },
        legalCases: {
          include: { legalUser: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        mediationCases: {
          include: { owner: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        approvals: {
          include: { applicant: true, approver: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        refundCases: {
          include: {
            requestedBy: true,
            reviewer: true,
            assignee: true,
            logs: {
              include: { operator: true },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        qualityRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        thirdSalesOrders: {
          include: { thirdSalesUser: true },
          orderBy: { createdAt: 'desc' },
        },
        contractArchives: {
          include: { contractSpecialist: true },
          orderBy: { createdAt: 'desc' },
        },
        followLogs: {
          include: { operator: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!customer) {
      const exists = await this.prisma.customer.findUnique({
        where: { id },
        select: { id: true },
      })
      if (exists) {
        throw new ForbiddenException('无权访问该客户')
      }
      throw new NotFoundException('客户不存在')
    }

    return customer
  }

  async buildCustomerVisibilityWhere(currentUser: AuthenticatedUser): Promise<Prisma.CustomerWhereInput> {
    switch (currentUser.customerScope) {
      case DataScope.ALL:
        return {}
      case DataScope.SELF:
        return {
          OR: [
            { currentOwnerId: currentUser.id },
            { firstSalesUserId: currentUser.id },
            { secondSalesUserId: currentUser.id },
            { legalUserId: currentUser.id },
            { thirdSalesUserId: currentUser.id },
          ],
        }
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return this.buildDepartmentCustomerWhere([currentUser.departmentId])
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return this.buildDepartmentCustomerWhere(
          await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId),
        )
      default:
        return { id: -1 }
    }
  }

  private buildDepartmentCustomerWhere(departmentIds: number[]): Prisma.CustomerWhereInput {
    return {
      OR: [
        { currentOwner: { departmentId: { in: departmentIds } } },
        { firstSalesUser: { departmentId: { in: departmentIds } } },
        { secondSalesUser: { departmentId: { in: departmentIds } } },
        { legalUser: { departmentId: { in: departmentIds } } },
        { thirdSalesUser: { departmentId: { in: departmentIds } } },
      ],
    }
  }

  private mapCustomerDetail(customer: any, currentUser: AuthenticatedUser) {
    const latestLegalCase = customer.legalCases[0]
    const latestMediationCase = customer.mediationCases[0]
    const contractArchiveMap = new Map(
      customer.contractArchives.map((item: any) => [
        `${item.salesStage}-${item.relatedOrderId}`,
        {
          id: item.id,
          contractNo: item.contractNo,
          amount: Number(item.amount),
          signDate: item.signDate,
          fileUrl: this.filesService.toAccessUrl(item.fileUrl),
          contractSpecialistName: item.contractSpecialist?.realName,
          remark: item.remark,
        },
      ]),
    )

    const firstSalesEvidence = customer.firstSalesOrders.flatMap((item: any) => {
      const result = [] as Array<{ label: string; url: string; source: 'FIRST_SALES' | 'SECOND_SALES' | 'MEDIATION' | 'THIRD_SALES' }>
      if (item.paymentScreenshotUrl) {
        result.push({ label: '一销付款截图', url: item.paymentScreenshotUrl, source: 'FIRST_SALES' })
      }
      if (item.chatRecordUrl) {
        result.push({ label: '一销聊天记录', url: item.chatRecordUrl, source: 'FIRST_SALES' })
      }
      for (const url of this.filesService.parseJsonFileUrls(item.evidenceImageUrls)) {
        result.push({ label: '一销证据', url, source: 'FIRST_SALES' })
      }
      return result
    })

    const secondSalesEvidence = customer.secondSalesOrders.flatMap((item: any) => {
      const result = [] as Array<{ label: string; url: string; source: 'FIRST_SALES' | 'SECOND_SALES' | 'MEDIATION' | 'THIRD_SALES' }>
      if (item.paymentScreenshotUrl) {
        result.push({ label: '二销付款截图', url: item.paymentScreenshotUrl, source: 'SECOND_SALES' })
      }
      if (item.chatRecordUrl) {
        result.push({ label: '二销聊天记录', url: item.chatRecordUrl, source: 'SECOND_SALES' })
      }
      for (const url of this.filesService.parseJsonFileUrls(item.evidenceFileUrls)) {
        result.push({ label: '二销证据', url, source: 'SECOND_SALES' })
      }
      return result
    })

    const mediationEvidence = this.filesService.parseJsonFileUrls(latestMediationCase?.evidenceFileUrls).map((url) => ({
      label: '调解证据',
      url,
      source: 'MEDIATION' as const,
    }))

    const thirdSalesEvidence = customer.thirdSalesOrders.flatMap((item: any) =>
      this.filesService.parseJsonFileUrls(item.evidenceFileUrls).map((url) => ({
        label: '三销证据',
        url,
        source: 'THIRD_SALES' as const,
      })),
    )

    return {
      ...this.toCustomerListItem(customer, currentUser),
      wechat: customer.wechat,
      gender: customer.gender,
      age: customer.age,
      province: customer.province,
      city: customer.city,
      source: customer.source,
      caseType: customer.caseType,
      intentionLevel: customer.intentionLevel,
      remark: customer.remark,
      followOwnerName: this.resolveFollowOwnerName(customer),
      followStageLabel: this.resolveFollowStageLabel(customer.currentStatus),
      isTailPaymentCompleted: customer.isTailPaymentCompleted,
      ownerChain: {
        firstSalesUserName: customer.firstSalesUser?.realName,
        firstSalesTeamName: this.resolveFirstSalesTeamName(customer.firstSalesUser),
        secondSalesUserName: customer.secondSalesUser?.realName,
        legalUserName: customer.legalUser?.realName,
        thirdSalesUserName: customer.thirdSalesUser?.realName,
      },
      paymentSummary: {
        targetAmount: Number(customer.targetAmount ?? 0),
        firstPaymentAmount: Number(customer.firstPaymentAmount),
        secondPaymentAmount: Number(customer.secondPaymentAmount),
        thirdPaymentAmount: Number(customer.thirdPaymentAmount),
        totalPaymentAmount: Number(customer.totalPaymentAmount),
        arrearsAmount: Number(customer.arrearsAmount),
      },
      legalCase: latestLegalCase
        ? {
            legalUserName: latestLegalCase.legalUser?.realName,
            progressStatus: latestLegalCase.progressStatus,
            caseResult: latestLegalCase.caseResult,
            remark: latestLegalCase.remark,
            isCompleted: latestLegalCase.isCompleted,
            filingApproved: latestLegalCase.filingApproved,
            createdAt: latestLegalCase.createdAt,
            updatedAt: latestLegalCase.updatedAt,
          }
        : null,
      mediationCase: latestMediationCase
        ? {
            ownerName: latestMediationCase.owner?.realName,
            progressStatus: latestMediationCase.progressStatus,
            mediationResult: latestMediationCase.mediationResult,
            remark: latestMediationCase.remark,
            evidenceFileUrls: this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(latestMediationCase.evidenceFileUrls)),
            finishDate: latestMediationCase.finishDate,
            createdAt: latestMediationCase.createdAt,
            updatedAt: latestMediationCase.updatedAt,
          }
        : null,
      evidenceSummary: {
        firstSales: firstSalesEvidence,
        secondSales: secondSalesEvidence,
        mediation: mediationEvidence,
        thirdSales: thirdSalesEvidence,
        combinedForSecondSales: firstSalesEvidence,
        combinedForLegalAndThirdSales: [...firstSalesEvidence, ...secondSalesEvidence],
        combinedAll: [...firstSalesEvidence, ...secondSalesEvidence, ...mediationEvidence, ...thirdSalesEvidence],
      },
      salesSummary: {
        customerRemark: customer.remark,
        firstSalesRemark: customer.firstSalesOrders[0]?.remark,
        secondSalesRemark: customer.secondSalesOrders[0]?.remark,
      },
      approvals: customer.approvals.map((item: any) => ({
        id: item.id,
        applicantName: item.applicant?.realName,
        approverName: item.approver?.realName,
        approvalType: item.approvalType,
        title: item.title,
        amount: Number(item.amount ?? 0),
        leaveDays: Number(item.leaveDays ?? 0),
        status: item.status,
        remark: item.remark,
        approvedAt: item.approvedAt,
        createdAt: item.createdAt,
      })),
      refundCases: customer.refundCases.map((item: any) => ({
        id: item.id,
        sourceStage: item.sourceStage,
        relatedOrderStage: item.relatedOrderStage,
        relatedOrderId: item.relatedOrderId,
        status: item.status,
        reason: item.reason,
        expectedRefundAmount: Number(item.expectedRefundAmount ?? 0),
        remark: item.remark,
        reviewRemark: item.reviewRemark,
        requestedByName: item.requestedBy?.realName,
        reviewerName: item.reviewer?.realName,
        assigneeName: item.assignee?.realName,
        reviewedAt: item.reviewedAt,
        assignedAt: item.assignedAt,
        closedAt: item.closedAt,
        createdAt: item.createdAt,
        logs: item.logs.map((log: any) => ({
          id: log.id,
          action: log.action,
          content: log.content,
          operatorName: log.operator?.realName,
          createdAt: log.createdAt,
        })),
      })),
      qualityRecords: customer.qualityRecords.map((item: any) => ({
        id: item.id,
        title: item.title,
        inspectorName: item.inspector?.realName,
        score: Number(item.score ?? 0),
        result: item.result,
        content: item.content,
        remark: item.remark,
        createdAt: item.createdAt,
      })),
      firstSalesOrders: customer.firstSalesOrders.map((item: any) => ({
        id: item.id,
        orderType: item.orderType,
        isTimelyDeal: item.isTimelyDeal,
        targetAmount: Number(item.targetAmount ?? 0),
        contractAmount: Number(item.contractAmount),
        paymentAmount: Number(item.paymentAmount),
        arrearsAmount: Number(item.arrearsAmount),
        paymentSerialNo: item.paymentSerialNo,
        paymentScreenshotUrl: this.filesService.toAccessUrl(item.paymentScreenshotUrl),
        chatRecordUrl: this.filesService.toAccessUrl(item.chatRecordUrl),
        evidenceImageUrls: this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(item.evidenceImageUrls)),
        paymentStatus: item.paymentStatus,
        contractArchive: contractArchiveMap.get(`FIRST-${item.id}`) || null,
        createdAt: item.createdAt,
      })),
      secondSalesOrders: customer.secondSalesOrders.map((item: any) => ({
        id: item.id,
        secondPaymentAmount: Number(item.secondPaymentAmount),
        includesHearing: item.includesHearing,
        hearingCostAmount: Number(item.hearingCostAmount),
        performanceAmount: Number(item.performanceAmount),
        paymentSerialNo: item.paymentSerialNo,
        paymentScreenshotUrl: this.filesService.toAccessUrl(item.paymentScreenshotUrl),
        chatRecordUrl: this.filesService.toAccessUrl(item.chatRecordUrl),
        evidenceFileUrls: this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(item.evidenceFileUrls)),
        contractArchive: contractArchiveMap.get(`SECOND-${item.id}`) || null,
        createdAt: item.createdAt,
      })),
      thirdSalesOrders: customer.thirdSalesOrders.map((item: any) => ({
        id: item.id,
        thirdSalesUserName: item.thirdSalesUser?.realName,
        productName: item.productName,
        paymentAmount: Number(item.paymentAmount),
        performanceAmount: Number(item.performanceAmount),
        remark: item.remark,
        evidenceFileUrls: this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(item.evidenceFileUrls)),
        orderDate: item.orderDate,
        contractArchive: contractArchiveMap.get(`THIRD-${item.id}`) || null,
        createdAt: item.createdAt,
      })),
      followLogs: customer.followLogs.map((item: any) => ({
        id: item.id,
        stage: item.stage,
        content: item.content,
        operatorName: item.operator.realName,
        nextFollowTime: item.nextFollowTime,
        createdAt: item.createdAt,
      })),
    }
  }

  private resolveFollowStage(status: CustomerStatus): FollowStage {
    switch (status) {
      case CustomerStatus.LEGAL_PROCESSING:
      case CustomerStatus.PENDING_THIRD_SALES:
        return FollowStage.LEGAL
      case CustomerStatus.THIRD_SALES_FOLLOWING:
      case CustomerStatus.COMPLETED_THIRD_SALES:
        return FollowStage.THIRD_SALES
      case CustomerStatus.MEDIATION_PROCESSING:
      case CustomerStatus.MEDIATION_COMPLETED:
        return FollowStage.MEDIATION
      case CustomerStatus.SECOND_SALES_FOLLOWING:
      case CustomerStatus.PENDING_LEGAL:
        return FollowStage.SECOND_SALES
      case CustomerStatus.INITIAL:
      case CustomerStatus.PENDING_TAIL_PAYMENT:
      case CustomerStatus.PENDING_SECOND_SALES_ASSIGNMENT:
      default:
        return FollowStage.FIRST_SALES
    }
  }

  private shouldViewOwnPhone(customer: {
    currentOwnerId?: number | null
    firstSalesUserId?: number | null
    secondSalesUserId?: number | null
    legalUserId?: number | null
    thirdSalesUserId?: number | null
  }, currentUser: AuthenticatedUser) {
    const ownerIds = [
      customer.currentOwnerId,
      customer.firstSalesUserId,
      customer.secondSalesUserId,
      customer.legalUserId,
      customer.thirdSalesUserId,
    ]

    return ownerIds.some((ownerId) => ownerId === currentUser.id)
  }

  private shouldMaskPhone(
    currentUser: AuthenticatedUser,
    customer?: {
      currentOwnerId?: number | null
      firstSalesUserId?: number | null
      secondSalesUserId?: number | null
      legalUserId?: number | null
      thirdSalesUserId?: number | null
    },
  ) {
    const permissions = new Set(currentUser.permissions || [])
    if (currentUser.roleCode === 'SUPER_ADMIN' || permissions.has('customers.phone.unmask')) {
      return false
    }

    if (customer && permissions.has('customers.phone.unmask.self') && this.shouldViewOwnPhone(customer, currentUser)) {
      return false
    }

    return true
  }

  private maskPhone(phone?: string | null) {
    if (!phone) {
      return ''
    }

    if (phone.length < 7) {
      return phone
    }

    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  }

  private toVisiblePhone(
    phone: string | null | undefined,
    currentUser: AuthenticatedUser,
    customer?: {
      currentOwnerId?: number | null
      firstSalesUserId?: number | null
      secondSalesUserId?: number | null
      legalUserId?: number | null
      thirdSalesUserId?: number | null
    },
  ) {
    const normalized = phone?.trim() || ''
    if (!normalized) {
      return ''
    }

    return this.shouldMaskPhone(currentUser, customer) ? this.maskPhone(normalized) : normalized
  }

  private resolveFollowOwnerName(customer: any) {
    switch (customer.currentStatus) {
      case CustomerStatus.LEGAL_PROCESSING:
      case CustomerStatus.PENDING_THIRD_SALES:
        return customer.legalUser?.realName || '-'
      case CustomerStatus.THIRD_SALES_FOLLOWING:
      case CustomerStatus.COMPLETED_THIRD_SALES:
        return customer.thirdSalesUser?.realName || '-'
      case CustomerStatus.MEDIATION_PROCESSING:
      case CustomerStatus.MEDIATION_COMPLETED:
        return customer.currentOwner?.realName || customer.legalUser?.realName || '-'
      case CustomerStatus.SECOND_SALES_FOLLOWING:
      case CustomerStatus.PENDING_LEGAL:
        return customer.secondSalesUser?.realName || '-'
      case CustomerStatus.INITIAL:
      case CustomerStatus.PENDING_TAIL_PAYMENT:
      case CustomerStatus.PENDING_SECOND_SALES_ASSIGNMENT:
      default:
        return customer.firstSalesUser?.realName || customer.currentOwner?.realName || '-'
    }
  }

  private resolveFollowStageLabel(status: CustomerStatus) {
    const labels: Record<FollowStage, string> = {
      FIRST_SALES: '一销跟进',
      SECOND_SALES: '二销跟进',
      LEGAL: '法务跟进',
      THIRD_SALES: '三销跟进',
      MEDIATION: '调解跟进',
    }

    return labels[this.resolveFollowStage(status)]
  }

  private resolveFirstSalesTeamName(firstSalesUser?: { departmentInfo?: { name?: string | null; parent?: { name?: string | null } | null } | null } | null) {
    return firstSalesUser?.departmentInfo?.parent?.name || firstSalesUser?.departmentInfo?.name || undefined
  }

  private toCustomerListItem(customer: any, currentUser: AuthenticatedUser) {
    const latestFollowLog = customer.followLogs?.[0]

    return {
      id: customer.id,
      customerNo: customer.customerNo,
      name: customer.name,
      phone: this.toVisiblePhone(customer.phone, currentUser, customer),
      wechat: customer.wechat,
      gender: customer.gender,
      age: customer.age,
      province: customer.province,
      city: customer.city,
      source: customer.source,
      caseType: customer.caseType,
      intentionLevel: customer.intentionLevel,
      currentStatus: CustomerStatusLabel[customer.currentStatus],
      firstSalesUserName: customer.firstSalesUser?.realName,
      firstSalesTeamName: this.resolveFirstSalesTeamName(customer.firstSalesUser),
      secondSalesUserName: customer.secondSalesUser?.realName,
      legalUserName: customer.legalUser?.realName,
      thirdSalesUserName: customer.thirdSalesUser?.realName,
      targetAmount: Number(customer.targetAmount ?? 0),
      firstPaymentAmount: Number(customer.firstPaymentAmount),
      secondPaymentAmount: Number(customer.secondPaymentAmount),
      thirdPaymentAmount: Number(customer.thirdPaymentAmount),
      totalPaymentAmount: Number(customer.totalPaymentAmount),
      arrearsAmount: Number(customer.arrearsAmount),
      isTailPaymentCompleted: customer.isTailPaymentCompleted,
      latestFollowOperatorName: latestFollowLog?.operator?.realName,
      latestFollowContent: latestFollowLog?.content,
      latestFollowTime: latestFollowLog?.createdAt,
      hasApprovalRecord: Boolean(customer.approvals?.length),
      hasQualityRecord: Boolean(customer.qualityRecords?.length),
      remark: customer.remark,
      followOwnerName: this.resolveFollowOwnerName(customer),
      followStageLabel: this.resolveFollowStageLabel(customer.currentStatus),
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }
  }
}
