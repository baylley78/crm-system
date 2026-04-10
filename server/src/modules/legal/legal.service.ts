import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CustomerStatus, FollowStage, LegalCaseStage } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { FilesService } from '../files/files.service'
import { SaveLegalCaseDto } from './dto/save-legal-case.dto'
import { TransferToThirdSalesDto } from './dto/transfer-to-third-sales.dto'
import { QueryLegalCasesDto } from './dto/query-legal-cases.dto'

const LEGAL_ROLE_CODES = ['SUPER_ADMIN', 'LEGAL_MANAGER', 'LEGAL']
const LEGAL_TIME_EDIT_PERMISSION = 'legal.time.edit'
const LEGAL_ASSIGN_PERMISSION = 'legal.assign'
const LEGAL_FILING_REVIEW_PERMISSION = 'legal.filing.review'
const LEGAL_PRETRIAL_HANDLE_PERMISSION = 'legal.pretrial.handle'
const LEGAL_CLOSE_PERMISSION = 'legal.close'
const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 30

@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly filesService: FilesService,
  ) {}

  async findCases(currentUser: AuthenticatedUser, query?: QueryLegalCasesDto) {
    const page = query?.page ?? DEFAULT_PAGE
    const pageSize = query?.pageSize ?? DEFAULT_PAGE_SIZE
    const skip = (page - 1) * pageSize
    const where = {
      ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      currentStatus: {
        in: [CustomerStatus.PENDING_LEGAL, CustomerStatus.LEGAL_PROCESSING, CustomerStatus.PENDING_THIRD_SALES],
      },
      ...(query?.stage
        ? {
            legalCases: {
              some: {
                stage: query.stage,
              },
            },
          }
        : {}),
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          legalUser: true,
          firstSalesOrders: {
            select: {
              remark: true,
              paymentScreenshotUrl: true,
              evidenceImageUrls: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          secondSalesOrders: {
            select: {
              remark: true,
              paymentScreenshotUrl: true,
              chatRecordUrl: true,
              evidenceFileUrls: true,
              paymentStatus: true,
              secondPaymentAmount: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          thirdSalesOrders: {
            select: {
              remark: true,
              paymentScreenshotUrl: true,
              chatRecordUrl: true,
              evidenceFileUrls: true,
              paymentStatus: true,
              paymentAmount: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          legalCases: {
            include: {
              legalUser: true,
              assistantUser: true,
              filingSpecialistUser: true,
              preTrialUser: true,
            },
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
        const latestCase = customer.legalCases[0]
        const latestFirstSalesOrder = customer.firstSalesOrders[0]
        const latestSecondSalesOrder = customer.secondSalesOrders[0]
        const latestThirdSalesOrder = customer.thirdSalesOrders[0]
        const firstSalesEvidence = customer.firstSalesOrders.flatMap((item) => this.buildFirstSalesEvidence(customer.firstSalesChatRecordUrl, item.paymentScreenshotUrl, item.evidenceImageUrls))
        const secondSalesEvidence = customer.secondSalesOrders.flatMap((item) => this.buildSalesEvidence(item.paymentScreenshotUrl, item.chatRecordUrl, item.evidenceFileUrls))
        const thirdSalesEvidence = customer.thirdSalesOrders.flatMap((item) => this.buildSalesEvidence(item.paymentScreenshotUrl, item.chatRecordUrl, item.evidenceFileUrls))
        return {
          customerId: customer.id,
          customerNo: customer.customerNo,
          name: customer.name,
          phone: customer.phone,
          currentOwnerId: customer.currentOwnerId ?? undefined,
          firstSalesUserId: customer.firstSalesUserId ?? undefined,
          secondSalesUserId: customer.secondSalesUserId ?? undefined,
          legalUserId: latestCase?.legalUserId ?? customer.legalUserId ?? undefined,
          thirdSalesUserId: customer.thirdSalesUserId ?? undefined,
          secondPaymentAmount: Number(customer.secondPaymentAmount),
          currentStatus: this.mapCustomerStatus(customer.currentStatus),
          legalUserName: latestCase?.legalUser?.realName ?? customer.legalUser?.realName,
          progressStatus: latestCase?.progressStatus ?? (customer.currentStatus === CustomerStatus.PENDING_LEGAL ? '待接案' : '处理中'),
          caseResult: latestCase?.caseResult ?? '',
          remark: latestCase?.remark ?? latestSecondSalesOrder?.remark ?? '',
          customerSituationRemark: latestSecondSalesOrder?.remark ?? latestFirstSalesOrder?.remark ?? customer.remark ?? '',
          firstSalesRemark: latestFirstSalesOrder?.remark ?? customer.remark ?? '',
          secondSalesRemark: latestSecondSalesOrder?.remark ?? '',
          thirdSalesRemark: latestThirdSalesOrder?.remark ?? '',
          upstreamEvidenceFileUrls: [...firstSalesEvidence, ...secondSalesEvidence, ...thirdSalesEvidence],
          firstSalesEvidenceFileUrls: firstSalesEvidence,
          secondSalesEvidenceFileUrls: secondSalesEvidence,
          thirdSalesEvidenceFileUrls: thirdSalesEvidence,
          secondSalesPaymentScreenshotUrl: this.filesService.toAccessUrl(latestSecondSalesOrder?.paymentScreenshotUrl),
          thirdSalesPaymentScreenshotUrl: this.filesService.toAccessUrl(latestThirdSalesOrder?.paymentScreenshotUrl),
          secondSalesChatRecordUrl: this.filesService.toAccessUrl(latestSecondSalesOrder?.chatRecordUrl),
          thirdSalesChatRecordUrl: this.filesService.toAccessUrl(latestThirdSalesOrder?.chatRecordUrl),
          secondSalesPaymentStatus: latestSecondSalesOrder?.paymentStatus ?? '',
          thirdSalesPaymentStatus: latestThirdSalesOrder?.paymentStatus ?? '',
          secondSalesPaymentAmount: Number(latestSecondSalesOrder?.secondPaymentAmount ?? 0),
          thirdSalesPaymentAmount: Number(latestThirdSalesOrder?.paymentAmount ?? 0),
          startDate: latestCase?.startDate?.toISOString(),
          isCompleted: latestCase?.isCompleted ?? false,
          filingApproved: latestCase?.filingApproved ?? false,
          stage: latestCase?.stage ?? LegalCaseStage.ASSISTANT,
          assistantUserId: latestCase?.assistantUserId ?? undefined,
          assistantUserName: latestCase?.assistantUser?.realName,
          filingSpecialistUserId: latestCase?.filingSpecialistUserId ?? undefined,
          filingSpecialistUserName: latestCase?.filingSpecialistUser?.realName,
          preTrialUserId: latestCase?.preTrialUserId ?? undefined,
          preTrialUserName: latestCase?.preTrialUser?.realName,
          assistantCollected: latestCase?.assistantCollected ?? false,
          assistantDocumented: latestCase?.assistantDocumented ?? false,
          archiveNeeded: latestCase?.archiveNeeded ?? false,
          archiveCompleted: latestCase?.archiveCompleted ?? false,
          filingReviewed: latestCase?.filingReviewed ?? false,
          transferredToPreTrial: latestCase?.transferredToPreTrial ?? false,
          acceptedAt: latestCase?.acceptedAt?.toISOString(),
          assistantTransferredAt: latestCase?.assistantTransferredAt?.toISOString(),
          filingApprovedAt: latestCase?.filingApprovedAt?.toISOString(),
          preTrialTransferredAt: latestCase?.preTrialTransferredAt?.toISOString(),
          closeResult: latestCase?.closeResult ?? '',
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
      .filter((user) => LEGAL_ROLE_CODES.includes(user.role.code))
      .map((user) => ({
        id: user.id,
        realName: user.realName,
        roleName: user.role.name,
        roleCode: user.role.code,
      }))
  }

  async saveCase(currentUser: AuthenticatedUser, dto: SaveLegalCaseDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: { legalCases: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (!customer) {
      throw new NotFoundException('客户不存在')
    }

    const legalUser = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!legalUser) {
      throw new NotFoundException('法务人员不存在')
    }

    const latestCase = customer.legalCases[0]
    this.assertSavePermissions(currentUser, dto, latestCase)

    const startDate = this.resolveStartDate(currentUser, dto.startDate, latestCase?.startDate)
    const stage = dto.stage ?? latestCase?.stage ?? LegalCaseStage.ASSISTANT
    const assistantCollected = dto.assistantCollected ?? latestCase?.assistantCollected ?? false
    const assistantDocumented = dto.assistantDocumented ?? latestCase?.assistantDocumented ?? false
    const archiveNeeded = dto.archiveNeeded ?? latestCase?.archiveNeeded ?? false
    const archiveCompleted = dto.archiveCompleted ?? latestCase?.archiveCompleted ?? false
    const filingReviewed = dto.filingReviewed ?? latestCase?.filingReviewed ?? false
    const filingApproved = dto.filingApproved ?? latestCase?.filingApproved ?? false
    const transferredToPreTrial = dto.transferredToPreTrial ?? latestCase?.transferredToPreTrial ?? false
    const isCompleted = dto.isCompleted ?? latestCase?.isCompleted ?? false
    const nextStatus = this.resolveNextCustomerStatus({ filingApproved, transferredToPreTrial, isCompleted })
    const acceptedAt = latestCase?.acceptedAt ?? new Date()
    const assistantTransferredAt = stage !== LegalCaseStage.ASSISTANT && !latestCase?.assistantTransferredAt ? new Date() : latestCase?.assistantTransferredAt ?? null
    const filingApprovedAt = filingApproved && !latestCase?.filingApprovedAt ? new Date() : latestCase?.filingApprovedAt ?? null
    const preTrialTransferredAt = transferredToPreTrial && !latestCase?.preTrialTransferredAt ? new Date() : latestCase?.preTrialTransferredAt ?? null
    const completedAt = isCompleted ? latestCase?.completedAt ?? new Date() : null

    await this.prisma.$transaction(async (tx) => {
      const casePayload = {
        legalUserId: currentUser.id,
        progressStatus: dto.progressStatus,
        caseResult: dto.caseResult,
        remark: dto.remark,
        startDate,
        isCompleted,
        filingApproved,
        completedAt,
        stage,
        assistantUserId: dto.assistantUserId ?? latestCase?.assistantUserId ?? currentUser.id,
        filingSpecialistUserId: dto.filingSpecialistUserId ?? latestCase?.filingSpecialistUserId ?? null,
        preTrialUserId: dto.preTrialUserId ?? latestCase?.preTrialUserId ?? null,
        assistantCollected,
        assistantDocumented,
        archiveNeeded,
        archiveCompleted,
        filingReviewed,
        transferredToPreTrial,
        acceptedAt,
        assistantTransferredAt,
        filingApprovedAt,
        preTrialTransferredAt,
        closeResult: dto.closeResult,
      }

      if (latestCase) {
        await tx.legalCase.update({
          where: { id: latestCase.id },
          data: casePayload,
        })
      } else {
        await tx.legalCase.create({
          data: {
            customerId: dto.customerId,
            ...casePayload,
          },
        })
      }

      await tx.customerFollowLog.create({
        data: {
          customerId: dto.customerId,
          operatorId: currentUser.id,
          stage: FollowStage.LEGAL,
          content: this.buildFollowContent({
            stage,
            progressStatus: dto.progressStatus,
            filingApproved,
            transferredToPreTrial,
            isCompleted,
          }),
        },
      })

      await tx.customer.update({
        where: { id: dto.customerId },
        data: {
          legalUserId: currentUser.id,
          currentOwnerId: currentUser.id,
          currentStatus: nextStatus,
          thirdSalesSourceStage: filingApproved ? 'LEGAL' : null,
        },
      })
    })

    return { success: true }
  }

  async transferToThirdSales(dto: TransferToThirdSalesDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } })

    if (!customer) {
      throw new NotFoundException('客户不存在')
    }

    if (customer.currentStatus !== CustomerStatus.PENDING_THIRD_SALES && customer.currentStatus !== CustomerStatus.LEGAL_PROCESSING) {
      throw new BadRequestException('当前客户状态不支持转入三销')
    }

    const latestCase = await this.prisma.legalCase.findFirst({
      where: { customerId: dto.customerId },
      orderBy: { createdAt: 'desc' },
    })

    if (!latestCase?.filingApproved || !latestCase.filingReviewed || !latestCase.transferredToPreTrial || latestCase.stage !== LegalCaseStage.CLOSED || !latestCase.isCompleted) {
      throw new BadRequestException('仅已完成法务流程的客户可转入三销')
    }

    await this.prisma.customer.update({
      where: { id: dto.customerId },
      data: {
        currentStatus: CustomerStatus.THIRD_SALES_FOLLOWING,
        thirdSalesSourceStage: 'LEGAL',
      },
    })

    return { success: true }
  }

  private assertSavePermissions(currentUser: AuthenticatedUser, dto: SaveLegalCaseDto, latestCase?: {
    assistantUserId?: number | null
    filingSpecialistUserId?: number | null
    preTrialUserId?: number | null
    filingReviewed?: boolean | null
    filingApproved?: boolean | null
    transferredToPreTrial?: boolean | null
    isCompleted?: boolean | null
    closeResult?: string | null
    stage?: LegalCaseStage | null
  } | null) {
    const permissions = new Set(currentUser.permissions || [])
    const currentStage = latestCase?.stage ?? LegalCaseStage.ASSISTANT

    const changedAssignment =
      (dto.assistantUserId !== undefined && dto.assistantUserId !== (latestCase?.assistantUserId ?? undefined)) ||
      (dto.filingSpecialistUserId !== undefined && dto.filingSpecialistUserId !== (latestCase?.filingSpecialistUserId ?? undefined)) ||
      (dto.preTrialUserId !== undefined && dto.preTrialUserId !== (latestCase?.preTrialUserId ?? undefined))

    if (changedAssignment && !permissions.has(LEGAL_ASSIGN_PERMISSION)) {
      throw new BadRequestException('无权分派法务岗位')
    }

    const nextStage = dto.stage ?? currentStage
    const enteredFilingStage = dto.stage !== undefined && currentStage !== LegalCaseStage.FILING_SPECIALIST && nextStage === LegalCaseStage.FILING_SPECIALIST
    const changedFilingReview =
      (dto.filingReviewed !== undefined && dto.filingReviewed !== (latestCase?.filingReviewed ?? false)) ||
      (dto.filingApproved !== undefined && dto.filingApproved !== (latestCase?.filingApproved ?? false)) ||
      enteredFilingStage

    if (changedFilingReview && !permissions.has(LEGAL_FILING_REVIEW_PERMISSION)) {
      throw new BadRequestException('无权执行立案审核操作')
    }

    const enteredPreTrialStage = dto.stage !== undefined && currentStage !== LegalCaseStage.PRE_TRIAL && nextStage === LegalCaseStage.PRE_TRIAL
    const changedPreTrial =
      (dto.transferredToPreTrial !== undefined && dto.transferredToPreTrial !== (latestCase?.transferredToPreTrial ?? false)) ||
      enteredPreTrialStage

    if (changedPreTrial && !permissions.has(LEGAL_PRETRIAL_HANDLE_PERMISSION)) {
      throw new BadRequestException('无权处理庭前阶段')
    }

    const enteredClosedStage = dto.stage !== undefined && currentStage !== LegalCaseStage.CLOSED && nextStage === LegalCaseStage.CLOSED
    const changedClose =
      (dto.isCompleted !== undefined && dto.isCompleted !== (latestCase?.isCompleted ?? false)) ||
      (dto.closeResult !== undefined && dto.closeResult !== (latestCase?.closeResult ?? '')) ||
      enteredClosedStage

    if (changedClose && !permissions.has(LEGAL_CLOSE_PERMISSION)) {
      throw new BadRequestException('无权执行法务结案操作')
    }
  }

  private resolveNextCustomerStatus(input: { filingApproved: boolean; transferredToPreTrial: boolean; isCompleted: boolean }) {
    if (input.filingApproved || input.transferredToPreTrial || input.isCompleted) {
      return CustomerStatus.PENDING_THIRD_SALES
    }

    return CustomerStatus.LEGAL_PROCESSING
  }

  private buildFirstSalesEvidence(chatRecordUrl?: string | null, paymentScreenshotUrl?: string | null, evidenceImageUrls?: string | null) {
    const result: string[] = []
    const paymentScreenshotAccessUrl = this.filesService.toAccessUrl(paymentScreenshotUrl)
    if (paymentScreenshotAccessUrl) {
      result.push(paymentScreenshotAccessUrl)
    }

    const chatRecordAccessUrl = this.filesService.toAccessUrl(chatRecordUrl)
    if (chatRecordAccessUrl) {
      result.push(chatRecordAccessUrl)
    }

    return [
      ...result,
      ...this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(evidenceImageUrls)),
    ]
  }

  private buildSalesEvidence(paymentScreenshotUrl?: string | null, chatRecordUrl?: string | null, evidenceFileUrls?: string | null) {
    const result: string[] = []
    const paymentScreenshotAccessUrl = this.filesService.toAccessUrl(paymentScreenshotUrl)
    if (paymentScreenshotAccessUrl) {
      result.push(paymentScreenshotAccessUrl)
    }

    const chatRecordAccessUrl = this.filesService.toAccessUrl(chatRecordUrl)
    if (chatRecordAccessUrl) {
      result.push(chatRecordAccessUrl)
    }

    return [
      ...result,
      ...this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(evidenceFileUrls)),
    ]
  }

  private buildFollowContent(input: { stage: LegalCaseStage; progressStatus: string; filingApproved: boolean; transferredToPreTrial: boolean; isCompleted: boolean }) {
    const stageLabel = this.mapLegalCaseStage(input.stage)
    const suffix: string[] = []
    if (input.filingApproved) suffix.push('立案已通过')
    if (input.transferredToPreTrial) suffix.push('已转庭前')
    if (input.isCompleted) suffix.push('已结案')
    return `法务阶段：${stageLabel}；进度：${input.progressStatus}${suffix.length ? `；${suffix.join('；')}` : ''}`
  }

  private mapLegalCaseStage(stage: LegalCaseStage) {
    const labels: Record<LegalCaseStage, string> = {
      ASSISTANT: '助理阶段',
      FILING_SPECIALIST: '立案专员阶段',
      PRE_TRIAL: '庭前阶段',
      CLOSED: '已结案',
    }

    return labels[stage]
  }

  private resolveStartDate(currentUser: AuthenticatedUser, input?: string, fallback?: Date | null) {
    if (!input) {
      return fallback ?? new Date()
    }

    if (!currentUser.permissions.includes(LEGAL_TIME_EDIT_PERMISSION)) {
      return fallback ?? new Date()
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('法务开始时间格式不正确')
    }

    return parsed
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
