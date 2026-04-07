import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ContractSalesStage, FollowStage, RefundAction, RefundSourceStage, RefundStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { DepartmentsService } from '../departments/departments.service'
import { CreateRefundCaseDto } from './dto/create-refund-case.dto'
import { ReviewRefundCaseDto, RefundReviewActionDto } from './dto/review-refund-case.dto'
import { AssignRefundCaseDto } from './dto/assign-refund-case.dto'
import { FollowRefundCaseDto } from './dto/follow-refund-case.dto'
import { CloseRefundCaseDto } from './dto/close-refund-case.dto'
import { QueryRefundCasesDto } from './dto/query-refund-cases.dto'
import { UpdateRefundFirstSalesDepartmentDto } from './dto/update-refund-first-sales-department.dto'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const REFUND_ROLE_CODES = ['SUPER_ADMIN', 'AFTER_SALES_MANAGER', 'AFTER_SALES']
const ACTIVE_REFUND_STATUSES = [RefundStatus.PENDING_REVIEW, RefundStatus.PENDING_ASSIGNMENT, RefundStatus.PROCESSING]

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async findCases(currentUser: AuthenticatedUser, query: QueryRefundCasesDto) {
    const page = query.page ?? DEFAULT_PAGE
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
    const skip = (page - 1) * pageSize
    const visibilityWhere = await this.customersService.buildCustomerVisibilityWhere(currentUser)
    const where = {
      customer: visibilityWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceStage ? { sourceStage: query.sourceStage } : {}),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.refundCase.findMany({
        where,
        include: {
          customer: true,
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
        skip,
        take: pageSize,
      }),
      this.prisma.refundCase.count({ where }),
    ])

    return {
      items: items.map((item) => this.mapRefundCase(item)),
      total,
      page,
      pageSize,
    }
  }

  async findCaseDetail(currentUser: AuthenticatedUser, id: number) {
    const item = await this.prisma.refundCase.findFirst({
      where: {
        id,
        customer: await this.customersService.buildCustomerVisibilityWhere(currentUser),
      },
      include: {
        customer: {
          include: {
            firstSalesUser: {
              include: {
                departmentInfo: {
                  include: { parent: true },
                },
              },
            },
            secondSalesUser: true,
            legalUser: true,
            thirdSalesUser: true,
          },
        },
        requestedBy: true,
        reviewer: true,
        assignee: true,
        logs: {
          include: { operator: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!item) {
      throw new NotFoundException('退款工单不存在')
    }

    return this.mapRefundCase(item, true)
  }

  async findUsers() {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { id: 'asc' },
    })

    return users
      .filter((user) => REFUND_ROLE_CODES.includes(user.role.code))
      .map((user) => ({
        id: user.id,
        realName: user.realName,
        roleName: user.role.name,
      }))
  }

  async findFirstSalesDepartments(currentUser: AuthenticatedUser) {
    const tree = await this.departmentsService.findTree(currentUser)

    const result: Array<{ id: number; name: string; parentId?: number; teamName?: string }> = []
    const walk = (nodes: Array<any>, parentName?: string) => {
      for (const node of nodes) {
        const isFirstSalesCandidate = parentName?.includes('一销') || node.name.includes('一销') || node.name.includes('销售')
        if (isFirstSalesCandidate) {
          result.push({
            id: node.id,
            name: node.name,
            parentId: node.parentId ?? undefined,
            teamName: parentName || node.name,
          })
        }
        if (node.children?.length) {
          walk(node.children, node.name)
        }
      }
    }

    walk(tree)
    return result
  }

  async createCase(currentUser: AuthenticatedUser, dto: CreateRefundCaseDto) {
    const visibilityWhere = await this.customersService.buildCustomerVisibilityWhere(currentUser)
    const trimmedPhone = dto.phone?.trim()
    const trimmedCustomerName = dto.customerName?.trim()

    let customer = dto.customerId
      ? await this.prisma.customer.findFirst({
          where: {
            id: dto.customerId,
            ...visibilityWhere,
          },
          include: {
            firstSalesUser: {
              include: {
                departmentInfo: {
                  include: { parent: true },
                },
              },
            },
          },
        })
      : null

    if (!customer && trimmedPhone) {
      customer = await this.prisma.customer.findFirst({
        where: {
          phone: trimmedPhone,
          ...visibilityWhere,
        },
        include: {
          firstSalesUser: {
            include: {
              departmentInfo: {
                include: { parent: true },
              },
            },
          },
        },
      })

      if (!customer) {
        const exists = await this.prisma.customer.findUnique({ where: { phone: trimmedPhone }, select: { id: true } })
        if (exists) {
          throw new ForbiddenException('无权访问该客户')
        }
      }
    }

    if (!customer && !trimmedPhone) {
      throw new BadRequestException('请填写客户手机号')
    }

    const customerId = customer?.id

    if (customerId) {
      const existingOpenCase = await this.prisma.refundCase.findFirst({
        where: {
          customerId,
          status: { in: ACTIVE_REFUND_STATUSES },
        },
        select: { id: true },
      })

      if (existingOpenCase) {
        throw new BadRequestException('该客户已有未关闭退款工单')
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const resolvedCustomer = customer
        ? customer
        : await tx.customer.create({
            data: {
              customerNo: this.generateCustomerNo(),
              name: trimmedCustomerName || trimmedPhone!,
              phone: trimmedPhone!,
              remark: dto.remark?.trim(),
            },
          })

      const firstSalesSnapshot = await this.resolveFirstSalesDepartmentSnapshot(dto.firstSalesDepartmentId, customer)

      const refundCase = await tx.refundCase.create({
        data: {
          customerId: resolvedCustomer.id,
          sourceStage: dto.sourceStage as RefundSourceStage,
          relatedOrderId: dto.relatedOrderId,
          relatedOrderStage: dto.relatedOrderStage as ContractSalesStage | undefined,
          firstSalesDepartmentId: firstSalesSnapshot.departmentId,
          firstSalesDepartmentName: firstSalesSnapshot.departmentName,
          firstSalesTeamName: firstSalesSnapshot.teamName,
          requestedById: currentUser.id,
          reason: dto.reason.trim(),
          expectedRefundAmount: dto.expectedRefundAmount ?? 0,
          remark: dto.remark?.trim(),
          status: RefundStatus.PENDING_REVIEW,
        },
      })

      await tx.refundCaseLog.create({
        data: {
          refundCaseId: refundCase.id,
          operatorId: currentUser.id,
          action: RefundAction.CREATE,
          content: this.buildCreateLogContent({
            ...dto,
            customerId: resolvedCustomer.id,
            customerName: resolvedCustomer.name,
            phone: resolvedCustomer.phone,
            firstSalesDepartmentName: firstSalesSnapshot.departmentName,
            firstSalesTeamName: firstSalesSnapshot.teamName,
          }),
        },
      })

      await tx.customerFollowLog.create({
        data: {
          customerId: resolvedCustomer.id,
          operatorId: currentUser.id,
          stage: FollowStage.MEDIATION,
          content: `发起退款申请；来源：${this.mapSourceStage(dto.sourceStage as RefundSourceStage)}；原因：${dto.reason.trim()}`,
        },
      })

      return tx.refundCase.findUnique({
        where: { id: refundCase.id },
        include: {
          customer: {
            include: {
              firstSalesUser: {
                include: {
                  departmentInfo: {
                    include: { parent: true },
                  },
                },
              },
              secondSalesUser: true,
              legalUser: true,
              thirdSalesUser: true,
            },
          },
          requestedBy: true,
          reviewer: true,
          assignee: true,
          logs: { include: { operator: true }, orderBy: { createdAt: 'asc' } },
        },
      })
    })

    return this.mapRefundCase(created!, true)
  }

  async updateFirstSalesDepartment(currentUser: AuthenticatedUser, id: number, dto: UpdateRefundFirstSalesDepartmentDto) {
    const refundCase = await this.prisma.refundCase.findFirst({
      where: {
        id,
        customer: await this.customersService.buildCustomerVisibilityWhere(currentUser),
      },
      include: {
        customer: {
          include: {
            firstSalesUser: {
              include: {
                departmentInfo: {
                  include: { parent: true },
                },
              },
            },
            secondSalesUser: true,
            legalUser: true,
            thirdSalesUser: true,
          },
        },
        requestedBy: true,
        reviewer: true,
        assignee: true,
        logs: { include: { operator: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    if (!refundCase) {
      throw new NotFoundException('退款工单不存在')
    }

    const snapshot = await this.resolveFirstSalesDepartmentSnapshot(dto.firstSalesDepartmentId, refundCase.customer)

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.refundCase.update({
        where: { id },
        data: {
          firstSalesDepartmentId: snapshot.departmentId,
          firstSalesDepartmentName: snapshot.departmentName,
          firstSalesTeamName: snapshot.teamName,
        },
      })

      await tx.refundCaseLog.create({
        data: {
          refundCaseId: id,
          operatorId: currentUser.id,
          action: RefundAction.FOLLOW,
          content: `更新一销归属：${refundCase.firstSalesTeamName || '-'} / ${refundCase.firstSalesDepartmentName || '-'} → ${snapshot.teamName || '-'} / ${snapshot.departmentName || '-'}`,
        },
      })

      return tx.refundCase.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              firstSalesUser: {
                include: {
                  departmentInfo: {
                    include: { parent: true },
                  },
                },
              },
              secondSalesUser: true,
              legalUser: true,
              thirdSalesUser: true,
            },
          },
          requestedBy: true,
          reviewer: true,
          assignee: true,
          logs: { include: { operator: true }, orderBy: { createdAt: 'asc' } },
        },
      })
    })

    return this.mapRefundCase(updated!, true)
  }

  async reviewCase(currentUser: AuthenticatedUser, id: number, dto: ReviewRefundCaseDto) {
    const refundCase = await this.getRefundCaseOrThrow(id)

    if (refundCase.status !== RefundStatus.PENDING_REVIEW) {
      throw new BadRequestException('当前退款工单不可审批')
    }

    const nextStatus = dto.action === RefundReviewActionDto.APPROVE ? RefundStatus.PENDING_ASSIGNMENT : RefundStatus.REJECTED
    const action = dto.action === RefundReviewActionDto.APPROVE ? RefundAction.REVIEW_APPROVE : RefundAction.REVIEW_REJECT

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.refundCase.update({
        where: { id },
        data: {
          reviewerId: currentUser.id,
          reviewRemark: dto.remark?.trim(),
          reviewedAt: new Date(),
          status: nextStatus,
        },
      })

      await tx.refundCaseLog.create({
        data: {
          refundCaseId: id,
          operatorId: currentUser.id,
          action,
          content: dto.action === RefundReviewActionDto.APPROVE ? `主管审批通过${dto.remark ? `；备注：${dto.remark.trim()}` : ''}` : `主管审批驳回${dto.remark ? `；备注：${dto.remark.trim()}` : ''}`,
        },
      })

      await tx.customerFollowLog.create({
        data: {
          customerId: refundCase.customerId,
          operatorId: currentUser.id,
          stage: FollowStage.MEDIATION,
          content: dto.action === RefundReviewActionDto.APPROVE ? '退款申请审批通过，待分配处理人' : '退款申请审批驳回',
        },
      })

      return tx.refundCase.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              firstSalesUser: {
                include: {
                  departmentInfo: {
                    include: { parent: true },
                  },
                },
              },
              secondSalesUser: true,
              legalUser: true,
              thirdSalesUser: true,
            },
          },
          requestedBy: true,
          reviewer: true,
          assignee: true,
          logs: { include: { operator: true }, orderBy: { createdAt: 'asc' } },
        },
      })
    })

    return this.mapRefundCase(updated!, true)
  }

  async assignCase(currentUser: AuthenticatedUser, id: number, dto: AssignRefundCaseDto) {
    const refundCase = await this.getRefundCaseOrThrow(id)

    if (refundCase.status !== RefundStatus.PENDING_ASSIGNMENT && refundCase.status !== RefundStatus.PROCESSING) {
      throw new BadRequestException('当前退款工单不可分配')
    }

    const assignee = await this.prisma.user.findUnique({ where: { id: dto.assigneeId }, include: { role: true } })
    if (!assignee || !REFUND_ROLE_CODES.includes(assignee.role.code)) {
      throw new BadRequestException('退款处理人不存在或角色不支持')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.refundCase.update({
        where: { id },
        data: {
          assigneeId: dto.assigneeId,
          assignedAt: new Date(),
          status: RefundStatus.PROCESSING,
        },
      })

      await tx.refundCaseLog.create({
        data: {
          refundCaseId: id,
          operatorId: currentUser.id,
          action: RefundAction.ASSIGN,
          content: `分配退款处理人：${assignee.realName}${dto.remark ? `；备注：${dto.remark.trim()}` : ''}`,
        },
      })

      await tx.customerFollowLog.create({
        data: {
          customerId: refundCase.customerId,
          operatorId: currentUser.id,
          stage: FollowStage.MEDIATION,
          content: `退款工单已分配给${assignee.realName}`,
        },
      })

      return tx.refundCase.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              firstSalesUser: {
                include: {
                  departmentInfo: {
                    include: { parent: true },
                  },
                },
              },
              secondSalesUser: true,
              legalUser: true,
              thirdSalesUser: true,
            },
          },
          requestedBy: true,
          reviewer: true,
          assignee: true,
          logs: { include: { operator: true }, orderBy: { createdAt: 'asc' } },
        },
      })
    })

    return this.mapRefundCase(updated!, true)
  }

  async followCase(currentUser: AuthenticatedUser, id: number, dto: FollowRefundCaseDto) {
    const refundCase = await this.getRefundCaseOrThrow(id)

    if (refundCase.status !== RefundStatus.PROCESSING) {
      throw new BadRequestException('仅处理中退款工单可跟进')
    }

    if (refundCase.assigneeId && refundCase.assigneeId !== currentUser.id && currentUser.roleCode !== 'SUPER_ADMIN' && currentUser.roleCode !== 'AFTER_SALES_MANAGER') {
      throw new ForbiddenException('当前退款工单不属于你处理')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.refundCaseLog.create({
        data: {
          refundCaseId: id,
          operatorId: currentUser.id,
          action: RefundAction.FOLLOW,
          content: dto.remark?.trim() ? `${dto.content.trim()}；备注：${dto.remark.trim()}` : dto.content.trim(),
        },
      })

      await tx.customerFollowLog.create({
        data: {
          customerId: refundCase.customerId,
          operatorId: currentUser.id,
          stage: FollowStage.MEDIATION,
          content: `退款工单跟进：${dto.content.trim()}`,
        },
      })
    })

    return this.findCaseDetail(currentUser, id)
  }

  async closeCase(currentUser: AuthenticatedUser, id: number, dto: CloseRefundCaseDto) {
    const refundCase = await this.getRefundCaseOrThrow(id)

    if (refundCase.status !== RefundStatus.PROCESSING) {
      throw new BadRequestException('仅处理中退款工单可完结')
    }

    if (refundCase.assigneeId && refundCase.assigneeId !== currentUser.id && currentUser.roleCode !== 'SUPER_ADMIN' && currentUser.roleCode !== 'AFTER_SALES_MANAGER') {
      throw new ForbiddenException('当前退款工单不属于你处理')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.refundCase.update({
        where: { id },
        data: {
          status: RefundStatus.CLOSED,
          closedAt: new Date(),
        },
      })

      await tx.refundCaseLog.create({
        data: {
          refundCaseId: id,
          operatorId: currentUser.id,
          action: RefundAction.CLOSE,
          content: `退款工单已完结${dto.remark ? `；备注：${dto.remark.trim()}` : ''}`,
        },
      })

      await tx.customerFollowLog.create({
        data: {
          customerId: refundCase.customerId,
          operatorId: currentUser.id,
          stage: FollowStage.MEDIATION,
          content: '退款工单已完结',
        },
      })

      return tx.refundCase.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              firstSalesUser: {
                include: {
                  departmentInfo: {
                    include: { parent: true },
                  },
                },
              },
              secondSalesUser: true,
              legalUser: true,
              thirdSalesUser: true,
            },
          },
          requestedBy: true,
          reviewer: true,
          assignee: true,
          logs: { include: { operator: true }, orderBy: { createdAt: 'asc' } },
        },
      })
    })

    return this.mapRefundCase(updated!, true)
  }

  private async getRefundCaseOrThrow(id: number) {
    const refundCase = await this.prisma.refundCase.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            firstSalesUser: {
              include: {
                departmentInfo: {
                  include: { parent: true },
                },
              },
            },
            secondSalesUser: true,
            legalUser: true,
            thirdSalesUser: true,
          },
        },
        requestedBy: true,
        reviewer: true,
        assignee: true,
        logs: { include: { operator: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    if (!refundCase) {
      throw new NotFoundException('退款工单不存在')
    }

    return refundCase
  }

  private async resolveFirstSalesDepartmentSnapshot(
    firstSalesDepartmentId: number | undefined,
    customer?: {
      firstSalesUser?: {
        departmentInfo?: {
          id: number
          name?: string | null
          parent?: { name?: string | null } | null
        } | null
      } | null
    } | null,
  ) {
    if (firstSalesDepartmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: firstSalesDepartmentId },
        include: { parent: true },
      })

      if (!department) {
        throw new BadRequestException('所选一销部门不存在')
      }

      return {
        departmentId: department.id,
        departmentName: department.name,
        teamName: department.parent?.name || department.name,
      }
    }

    const customerDepartment = customer?.firstSalesUser?.departmentInfo
    return {
      departmentId: customerDepartment?.id,
      departmentName: customerDepartment?.name || undefined,
      teamName: customerDepartment?.parent?.name || customerDepartment?.name || undefined,
    }
  }

  private buildCreateLogContent(dto: CreateRefundCaseDto & { firstSalesDepartmentName?: string; firstSalesTeamName?: string }) {
    const parts = [
      `发起退款申请`,
      `来源：${this.mapSourceStage(dto.sourceStage as RefundSourceStage)}`,
      dto.relatedOrderStage ? `关联订单阶段：${dto.relatedOrderStage}` : '',
      dto.relatedOrderId ? `关联订单ID：${dto.relatedOrderId}` : '',
      dto.firstSalesTeamName ? `一销团队：${dto.firstSalesTeamName}` : '',
      dto.firstSalesDepartmentName ? `一销部门：${dto.firstSalesDepartmentName}` : '',
      dto.expectedRefundAmount !== undefined ? `期望退款金额：${dto.expectedRefundAmount}` : '',
      `原因：${dto.reason.trim()}`,
      dto.remark?.trim() ? `备注：${dto.remark.trim()}` : '',
    ].filter(Boolean)

    return parts.join('；')
  }

  private mapSourceStage(stage: RefundSourceStage) {
    const labels: Record<RefundSourceStage, string> = {
      FIRST_SALES: '一销',
      SECOND_SALES: '二销',
      LEGAL: '法务',
      MEDIATION: '调解',
      THIRD_SALES: '三销',
      CUSTOMER: '客户列表',
    }

    return labels[stage]
  }

  private mapStatus(status: RefundStatus) {
    const labels: Record<RefundStatus, string> = {
      PENDING_REVIEW: '待主管审批',
      PENDING_ASSIGNMENT: '待分配处理人',
      PROCESSING: '处理中',
      REJECTED: '已驳回',
      CLOSED: '已完结',
    }

    return labels[status]
  }

  async removeCase(currentUser: AuthenticatedUser, id: number) {
    const refundCase = await this.prisma.refundCase.findFirst({
      where: {
        id,
        customer: await this.customersService.buildCustomerVisibilityWhere(currentUser),
      },
      select: { id: true },
    })

    if (!refundCase) {
      throw new NotFoundException('退款工单不存在')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.refundCaseLog.deleteMany({ where: { refundCaseId: id } })
      await tx.refundCase.delete({ where: { id } })
    })

    return { success: true }
  }

  private generateCustomerNo() {
    const now = new Date()
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

    return `KH${datePart}${timePart}`
  }

  private mapRefundCase(item: any, includeCustomerDetail = false) {
    return {
      id: item.id,
      customerId: item.customerId,
      customerNo: item.customer?.customerNo,
      customerName: item.customer?.name,
      phone: item.customer?.phone,
      sourceStage: item.sourceStage,
      sourceStageLabel: this.mapSourceStage(item.sourceStage),
      relatedOrderId: item.relatedOrderId ?? undefined,
      relatedOrderStage: item.relatedOrderStage ?? undefined,
      firstSalesDepartmentId: item.firstSalesDepartmentId ?? undefined,
      firstSalesDepartmentName: item.firstSalesDepartmentName ?? undefined,
      firstSalesTeamName: item.firstSalesTeamName ?? undefined,
      status: item.status,
      statusLabel: this.mapStatus(item.status),
      reason: item.reason,
      expectedRefundAmount: Number(item.expectedRefundAmount ?? 0),
      remark: item.remark,
      reviewRemark: item.reviewRemark,
      reviewerId: item.reviewerId ?? undefined,
      reviewerName: item.reviewer?.realName,
      assigneeId: item.assigneeId ?? undefined,
      assigneeName: item.assignee?.realName,
      requestedById: item.requestedById,
      requestedByName: item.requestedBy?.realName,
      reviewedAt: item.reviewedAt,
      assignedAt: item.assignedAt,
      closedAt: item.closedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      logs: (item.logs || []).map((log: any) => ({
        id: log.id,
        action: log.action,
        content: log.content,
        operatorId: log.operatorId,
        operatorName: log.operator?.realName,
        createdAt: log.createdAt,
      })),
      customer: includeCustomerDetail
        ? {
            id: item.customer?.id,
            customerNo: item.customer?.customerNo,
            name: item.customer?.name,
            phone: item.customer?.phone,
            source: item.customer?.source,
            caseType: item.customer?.caseType,
            intentionLevel: item.customer?.intentionLevel,
            firstSalesUserName: item.customer?.firstSalesUser?.realName,
            firstSalesTeamName: item.customer?.firstSalesUser?.departmentInfo?.parent?.name || item.customer?.firstSalesUser?.departmentInfo?.name || undefined,
            secondSalesUserName: item.customer?.secondSalesUser?.realName,
            legalUserName: item.customer?.legalUser?.realName,
            thirdSalesUserName: item.customer?.thirdSalesUser?.realName,
            firstPaymentAmount: Number(item.customer?.firstPaymentAmount ?? 0),
            secondPaymentAmount: Number(item.customer?.secondPaymentAmount ?? 0),
            thirdPaymentAmount: Number(item.customer?.thirdPaymentAmount ?? 0),
            totalPaymentAmount: Number(item.customer?.totalPaymentAmount ?? 0),
            arrearsAmount: Number(item.customer?.arrearsAmount ?? 0),
          }
        : undefined,
    }
  }
}
