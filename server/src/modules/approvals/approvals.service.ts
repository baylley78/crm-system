import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ApprovalStatus, ApprovalType, DataScope, Prisma, ReimbursementPaymentStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { FilesService } from '../files/files.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CreateApprovalDto, ApprovalTypeDto } from './dto/create-approval.dto'
import { ApprovalActionDto, ApprovalActionTypeDto } from './dto/approval-action.dto'
import { QueryApprovalsDto } from './dto/query-approvals.dto'
import { ApprovalPayDto } from './dto/approval-pay.dto'

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
    private readonly filesService: FilesService,
  ) {}

  async findAll(currentUser: AuthenticatedUser, query: QueryApprovalsDto) {
    const visibilityWhere = await this.buildVisibilityWhere(currentUser)
    const filterWhere = this.buildFilterWhere(query)
    const where: Prisma.ApprovalWhereInput = {
      AND: [visibilityWhere, filterWhere],
    }

    const approvals = await this.prisma.approval.findMany({
      where,
      include: {
        applicant: true,
        approver: true,
        customer: true,
        paidBy: true,
        steps: {
          include: { approver: true },
          orderBy: { step: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const items = approvals.map((item) => this.mapApproval(item, currentUser.id))
    const typedItems = query.approvalType ? items : items
    const myApplications = typedItems.filter((item) => item.applicantId === currentUser.id)
    const pendingApprovals = typedItems.filter((item) => item.status === ApprovalStatus.PENDING && item.approverId === currentUser.id)
    const processedApprovals = typedItems.filter(
      (item) =>
        item.steps.some(
          (step) =>
            step.approverId === currentUser.id &&
            (step.status === ApprovalStatus.APPROVED || step.status === ApprovalStatus.REJECTED),
        ) && !(item.status === ApprovalStatus.PENDING && item.approverId === currentUser.id),
    )
    const reimbursementItems = typedItems.filter((item) => item.approvalType === ApprovalType.REIMBURSEMENT)

    return {
      myApplications,
      pendingApprovals,
      processedApprovals,
      allApplications: typedItems,
      reimbursementItems,
      summary: this.buildReimbursementSummaryFromItems(reimbursementItems),
    }
  }

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateApprovalDto,
    files?: {
      reimbursementVoucher?: { filename: string }
    },
  ) {
    const applicant = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!applicant) {
      throw new NotFoundException('申请人不存在')
    }
    if (!applicant.departmentId) {
      throw new BadRequestException('申请人未分配部门，无法发起审批')
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } })
      if (!customer) {
        throw new NotFoundException('关联客户不存在')
      }
    }

    const reimbursementVoucherUrl = files?.reimbursementVoucher ? `/uploads/${files.reimbursementVoucher.filename}` : dto.reimbursementVoucherUrl

    if (dto.approvalType === ApprovalTypeDto.REIMBURSEMENT) {
      if (!dto.amount || dto.amount < 0) {
        throw new BadRequestException('报销金额不能为空')
      }
      if (!dto.reimbursementAccountName?.trim()) {
        throw new BadRequestException('收款账户不能为空')
      }
      if (!dto.reimbursementPayeeName?.trim()) {
        throw new BadRequestException('姓名不能为空')
      }
      if (!dto.reimbursementBankName?.trim()) {
        throw new BadRequestException('开户行不能为空')
      }
      if (!dto.reimbursementCardNo?.trim()) {
        throw new BadRequestException('卡号不能为空')
      }
      if (!reimbursementVoucherUrl) {
        throw new BadRequestException('请上传报销凭证')
      }
    }

    const leaderChain = await this.departmentsService.findDepartmentLeaderChain(applicant.departmentId, 3)
    if (!leaderChain.length) {
      throw new BadRequestException('当前部门链未设置负责人，无法发起审批')
    }

    const approval = await this.prisma.$transaction(async (tx) => {
      const created = await tx.approval.create({
        data: {
          applicantId: currentUser.id,
          customerId: dto.customerId,
          approvalType: dto.approvalType as ApprovalType,
          title: dto.title,
          amount: dto.approvalType === ApprovalTypeDto.REIMBURSEMENT ? dto.amount ?? 0 : 0,
          leaveDays: dto.approvalType === ApprovalTypeDto.LEAVE ? dto.leaveDays ?? 0 : 0,
          punchDate: dto.approvalType === ApprovalTypeDto.PUNCH_CARD && dto.punchDate ? new Date(dto.punchDate) : undefined,
          punchTime: dto.approvalType === ApprovalTypeDto.PUNCH_CARD ? dto.punchTime : undefined,
          reason: dto.reason,
          reimbursementAccountName: dto.approvalType === ApprovalTypeDto.REIMBURSEMENT ? dto.reimbursementAccountName?.trim() : undefined,
          reimbursementPayeeName: dto.approvalType === ApprovalTypeDto.REIMBURSEMENT ? dto.reimbursementPayeeName?.trim() : undefined,
          reimbursementBankName: dto.approvalType === ApprovalTypeDto.REIMBURSEMENT ? dto.reimbursementBankName?.trim() : undefined,
          reimbursementCardNo: dto.approvalType === ApprovalTypeDto.REIMBURSEMENT ? dto.reimbursementCardNo?.trim() : undefined,
          reimbursementVoucherUrl: dto.approvalType === ApprovalTypeDto.REIMBURSEMENT ? reimbursementVoucherUrl : undefined,
          remark: dto.remark,
          status: ApprovalStatus.PENDING,
          approverId: leaderChain[0].leaderUserId,
          currentStep: 1,
          maxStep: leaderChain.length,
        },
      })

      await tx.approvalStep.createMany({
        data: leaderChain.map((item, index) => ({
          approvalId: created.id,
          step: index + 1,
          approverId: item.leaderUserId,
          status: ApprovalStatus.PENDING,
        })),
      })

      return tx.approval.findUnique({
        where: { id: created.id },
        include: {
          applicant: true,
          approver: true,
          customer: true,
          paidBy: true,
          steps: {
            include: { approver: true },
            orderBy: { step: 'asc' },
          },
        },
      })
    })

    return this.mapApproval(approval!, currentUser.id)
  }

  async action(id: number, currentUser: AuthenticatedUser, dto: ApprovalActionDto) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: {
        applicant: true,
        approver: true,
        customer: true,
        paidBy: true,
        steps: {
          include: { approver: true },
          orderBy: { step: 'asc' },
        },
      },
    })

    if (!approval) {
      throw new NotFoundException('审批记录不存在')
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('仅待审批记录可处理')
    }

    const currentStep = approval.steps.find((item) => item.step === approval.currentStep)
    if (!currentStep) {
      throw new BadRequestException('审批流配置异常')
    }
    if (currentStep.approverId !== currentUser.id) {
      throw new ForbiddenException('当前审批不属于你处理')
    }

    const nextStatus = dto.action === ApprovalActionTypeDto.APPROVE ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { approvalId_step: { approvalId: approval.id, step: currentStep.step } },
        data: {
          status: nextStatus,
          remark: dto.remark,
          handledAt: new Date(),
        },
      })

      if (dto.action === ApprovalActionTypeDto.REJECT) {
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.REJECTED,
            approverId: currentUser.id,
            approvedAt: new Date(),
            remark: dto.remark,
          },
        })
      } else {
        const nextStepNumber = currentStep.step + 1
        const nextStep = approval.steps.find((item) => item.step === nextStepNumber)
        if (!nextStep) {
          await tx.approval.update({
            where: { id: approval.id },
            data: {
              status: ApprovalStatus.APPROVED,
              approverId: currentUser.id,
              approvedAt: new Date(),
              remark: dto.remark,
              currentStep: currentStep.step,
            },
          })
        } else {
          await tx.approval.update({
            where: { id: approval.id },
            data: {
              approverId: nextStep.approverId,
              currentStep: nextStepNumber,
              remark: dto.remark,
            },
          })
        }
      }

      return tx.approval.findUnique({
        where: { id: approval.id },
        include: {
          applicant: true,
          approver: true,
          customer: true,
          paidBy: true,
          steps: {
            include: { approver: true },
            orderBy: { step: 'asc' },
          },
        },
      })
    })

    return this.mapApproval(updated!, currentUser.id)
  }

  async pay(id: number, currentUser: AuthenticatedUser, dto: ApprovalPayDto) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: {
        applicant: true,
        approver: true,
        customer: true,
        paidBy: true,
        steps: {
          include: { approver: true },
          orderBy: { step: 'asc' },
        },
      },
    })

    if (!approval) {
      throw new NotFoundException('审批记录不存在')
    }

    if (approval.approvalType !== ApprovalType.REIMBURSEMENT) {
      throw new BadRequestException('仅报销申请支持打款')
    }

    if (approval.status !== ApprovalStatus.APPROVED) {
      throw new BadRequestException('仅已通过的报销申请可打款')
    }

    if (approval.paymentStatus === ReimbursementPaymentStatus.PAID) {
      throw new BadRequestException('该报销申请已打款')
    }

    const updated = await this.prisma.approval.update({
      where: { id: approval.id },
      data: {
        paymentStatus: ReimbursementPaymentStatus.PAID,
        paidAt: new Date(),
        paidById: currentUser.id,
        remark: dto.remark?.trim() || approval.remark,
      },
      include: {
        applicant: true,
        approver: true,
        customer: true,
        paidBy: true,
        steps: {
          include: { approver: true },
          orderBy: { step: 'asc' },
        },
      },
    })

    return this.mapApproval(updated, currentUser.id)
  }

  private buildFilterWhere(query: QueryApprovalsDto): Prisma.ApprovalWhereInput {
    const dateRange = this.resolveDateRange(query)

    return {
      ...(query.approvalType ? { approvalType: query.approvalType as ApprovalType } : {}),
      ...(query.statusView === 'PENDING'
        ? { status: ApprovalStatus.PENDING }
        : query.statusView === 'PROCESSED'
          ? { status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] } }
          : query.statusView === 'UNPAID'
            ? { approvalType: ApprovalType.REIMBURSEMENT, status: ApprovalStatus.APPROVED, paymentStatus: ReimbursementPaymentStatus.UNPAID }
            : query.statusView === 'PAID'
              ? { approvalType: ApprovalType.REIMBURSEMENT, status: ApprovalStatus.APPROVED, paymentStatus: ReimbursementPaymentStatus.PAID }
              : {}),
      ...(dateRange
        ? {
            createdAt: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          }
        : {}),
    }
  }

  private resolveDateRange(query: QueryApprovalsDto) {
    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate)
      const end = new Date(query.endDate)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    const now = new Date()
    if (query.quickRange === 'DAY') {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    if (query.quickRange === 'WEEK') {
      const day = now.getDay() || 7
      const start = new Date(now)
      start.setDate(now.getDate() - day + 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    if (query.quickRange === 'MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }

    return null
  }

  private buildReimbursementSummaryFromItems(items: Array<{ amount: number; paymentStatus?: ReimbursementPaymentStatus; status: ApprovalStatus }>) {
    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    const paidAmount = items
      .filter((item) => item.status === ApprovalStatus.APPROVED && item.paymentStatus === ReimbursementPaymentStatus.PAID)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    const unpaidAmount = items
      .filter((item) => item.status === ApprovalStatus.APPROVED && item.paymentStatus !== ReimbursementPaymentStatus.PAID)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

    return {
      paidAmount,
      unpaidAmount,
      totalAmount,
    }
  }

  private async buildVisibilityWhere(currentUser: AuthenticatedUser): Promise<Prisma.ApprovalWhereInput> {
    const base: Prisma.ApprovalWhereInput = {
      OR: [{ applicantId: currentUser.id }, { approverId: currentUser.id }, { steps: { some: { approverId: currentUser.id } } }],
    }

    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return {}
      case DataScope.SELF:
        return base
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId) {
          return base
        }
        return {
          OR: [
            base,
            {
              applicant: {
                departmentId: currentUser.departmentId,
              },
            },
          ],
        }
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return base
        }
        return {
          OR: [
            base,
            {
              applicant: {
                departmentId: {
                  in: await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId),
                },
              },
            },
          ],
        }
      default:
        return base
    }
  }

  private mapApproval(
    item: {
      id: number
      applicantId: number
      approverId: number | null
      customerId: number | null
      approvalType: ApprovalType
      title: string
      amount: unknown
      leaveDays: unknown
      punchDate: Date | null
      punchTime: string | null
      reason: string
      status: ApprovalStatus
      paymentStatus: ReimbursementPaymentStatus
      currentStep: number
      maxStep: number
      remark: string | null
      reimbursementAccountName: string | null
      reimbursementPayeeName: string | null
      reimbursementBankName: string | null
      reimbursementCardNo: string | null
      reimbursementVoucherUrl: string | null
      approvedAt: Date | null
      paidAt: Date | null
      createdAt: Date
      applicant: { realName: string }
      approver: { realName: string } | null
      customer: { name: string } | null
      paidBy: { realName: string } | null
      steps: Array<{
        step: number
        approverId: number
        status: ApprovalStatus
        remark: string | null
        handledAt: Date | null
        approver: { realName: string }
      }>
    },
    currentUserId: number,
  ) {
    return {
      id: item.id,
      applicantId: item.applicantId,
      applicantName: item.applicant.realName,
      approverId: item.approverId ?? undefined,
      approverName: item.approver?.realName,
      customerId: item.customerId ?? undefined,
      customerName: item.customer?.name,
      approvalType: item.approvalType,
      title: item.title,
      amount: Number(item.amount ?? 0),
      leaveDays: Number(item.leaveDays ?? 0),
      punchDate: item.punchDate?.toISOString(),
      punchTime: item.punchTime ?? undefined,
      reason: item.reason,
      reimbursementAccountName: item.reimbursementAccountName ?? undefined,
      reimbursementPayeeName: item.reimbursementPayeeName ?? undefined,
      reimbursementBankName: item.reimbursementBankName ?? undefined,
      reimbursementCardNo: item.reimbursementCardNo ?? undefined,
      reimbursementVoucherUrl: this.filesService.toAccessUrl(item.reimbursementVoucherUrl),
      status: item.status,
      paymentStatus: item.paymentStatus,
      currentStep: item.currentStep,
      maxStep: item.maxStep,
      remark: item.remark ?? undefined,
      approvedAt: item.approvedAt?.toISOString(),
      paidAt: item.paidAt?.toISOString(),
      paidByName: item.paidBy?.realName,
      createdAt: item.createdAt.toISOString(),
      canApprove: item.status === ApprovalStatus.PENDING && item.approverId === currentUserId,
      steps: item.steps.map((step) => ({
        step: step.step,
        approverId: step.approverId,
        approverName: step.approver.realName,
        status: step.status,
        remark: step.remark ?? undefined,
        handledAt: step.handledAt?.toISOString(),
      })),
    }
  }
}
