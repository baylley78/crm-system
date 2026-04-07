import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CustomerStatus, DataScope, FinanceReviewStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { DepartmentsService } from '../departments/departments.service'
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service'
import { CourtConfigService } from '../court-config/court-config.service'
import { FilesService } from '../files/files.service'
import { DingTalkReportService } from '../dingtalk-report/dingtalk-report.service'
import { QueryOrderListDto } from '../../common/dto/query-order-list.dto'
import { BatchFinanceReviewDto } from '../first-sales/dto/batch-finance-review.dto'
import { FinanceReviewActionDto, FinanceReviewActionTypeDto } from '../first-sales/dto/finance-review-action.dto'
import { CreateThirdSalesOrderDto, SearchThirdSalesCustomerDto } from './dto/third-sales.dto'

const THIRD_SALES_ROLE_CODES = ['SUPER_ADMIN', 'SECOND_SALES_MANAGER', 'SECOND_SALES_SUPERVISOR', 'SECOND_SALES', 'THIRD_SALES']
const THIRD_SALES_TIME_EDIT_PERMISSION = 'thirdSales.time.edit'

@Injectable()
export class ThirdSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly departmentsService: DepartmentsService,
    private readonly paymentAccountsService: PaymentAccountsService,
    private readonly courtConfigService: CourtConfigService,
    private readonly dingTalkReportService: DingTalkReportService,
    private readonly filesService: FilesService,
  ) {}

  private async ensurePaymentSerialNoUnique(paymentSerialNo: string, current?: { stage: 'FIRST' | 'SECOND' | 'THIRD'; id: number }) {
    const normalized = paymentSerialNo.trim()
    if (!normalized) {
      return
    }

    const [firstOrder, secondOrder, thirdOrder] = await Promise.all([
      this.prisma.firstSalesOrder.findFirst({ where: { paymentSerialNo: normalized }, select: { id: true } }),
      this.prisma.secondSalesOrder.findFirst({ where: { paymentSerialNo: normalized }, select: { id: true } }),
      this.prisma.thirdSalesOrder.findFirst({ where: { paymentSerialNo: normalized }, select: { id: true } }),
    ])

    const duplicated = [
      firstOrder ? { stage: 'FIRST' as const, id: firstOrder.id } : null,
      secondOrder ? { stage: 'SECOND' as const, id: secondOrder.id } : null,
      thirdOrder ? { stage: 'THIRD' as const, id: thirdOrder.id } : null,
    ].find((item) => item && (!current || item.stage !== current.stage || item.id !== current.id))

    if (duplicated) {
      throw new BadRequestException('付款单号已存在')
    }
  }

  async findUsers() {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { id: 'asc' },
    })

    return users
      .filter((user) => THIRD_SALES_ROLE_CODES.includes(user.role.code))
      .map((user) => ({
        id: user.id,
        realName: user.realName,
        roleName: user.role.name,
      }))
  }

  async searchCustomer(currentUser: AuthenticatedUser, dto: SearchThirdSalesCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        phone: dto.phone,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
      include: {
        firstSalesUser: true,
        secondSalesUser: true,
        thirdSalesUser: true,
      },
    })

    if (!customer) {
      return null
    }

    return {
      id: customer.id,
      customerNo: customer.customerNo,
      name: customer.name,
      phone: customer.phone,
      currentOwnerId: customer.currentOwnerId ?? undefined,
      firstSalesUserId: customer.firstSalesUserId ?? undefined,
      secondSalesUserId: customer.secondSalesUserId ?? undefined,
      legalUserId: customer.legalUserId ?? undefined,
      thirdSalesUserId: customer.thirdSalesUserId ?? undefined,
      currentStatus: this.mapCustomerStatus(customer.currentStatus),
      thirdSalesSourceStage: customer.thirdSalesSourceStage ?? undefined,
      caseType: customer.caseType,
      source: customer.source,
      intentionLevel: customer.intentionLevel,
      firstSalesUserName: customer.firstSalesUser?.realName,
      secondSalesUserName: customer.secondSalesUser?.realName,
      thirdSalesUserName: customer.thirdSalesUser?.realName,
      firstPaymentAmount: Number(customer.firstPaymentAmount),
      secondPaymentAmount: Number(customer.secondPaymentAmount),
      thirdPaymentAmount: Number(customer.thirdPaymentAmount),
      totalPaymentAmount: Number(customer.totalPaymentAmount),
      arrearsAmount: Number(customer.arrearsAmount),
    }
  }

  async findOrders(currentUser: AuthenticatedUser, query?: QueryOrderListDto) {
    const page = query?.page ?? 1
    const pageSize = query?.pageSize ?? 10
    const skip = (page - 1) * pageSize
    const where = await this.buildVisibilityWhere(currentUser)

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.thirdSalesOrder.findMany({
        where,
        include: {
          customer: {
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
            },
          },
          thirdSalesUser: true,
          financeReviewer: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.thirdSalesOrder.count({ where }),
    ])

    return {
      items: orders.map((order) => this.mapOrder(order)),
      total,
      page,
      pageSize,
    }
  }

  async findReceptions(currentUser: AuthenticatedUser, query?: QueryOrderListDto) {
    const page = query?.page ?? 1
    const pageSize = query?.pageSize ?? 10
    const skip = (page - 1) * pageSize
    const where = {
      ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      currentStatus: {
        in: [CustomerStatus.PENDING_THIRD_SALES, CustomerStatus.THIRD_SALES_FOLLOWING],
      },
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          firstSalesUser: true,
          secondSalesUser: true,
          thirdSalesUser: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ])

    return {
      items: customers.map((customer) => ({
        id: customer.id,
        customerNo: customer.customerNo,
        name: customer.name,
        phone: customer.phone,
        currentOwnerId: customer.currentOwnerId ?? undefined,
        firstSalesUserId: customer.firstSalesUserId ?? undefined,
        secondSalesUserId: customer.secondSalesUserId ?? undefined,
        legalUserId: customer.legalUserId ?? undefined,
        thirdSalesUserId: customer.thirdSalesUserId ?? undefined,
        currentStatus: this.mapCustomerStatus(customer.currentStatus),
        caseType: customer.caseType,
        source: customer.source,
        intentionLevel: customer.intentionLevel,
        firstSalesUserName: customer.firstSalesUser?.realName,
        secondSalesUserName: customer.secondSalesUser?.realName,
        thirdSalesUserName: customer.thirdSalesUser?.realName,
        thirdSalesSourceStage: customer.thirdSalesSourceStage ?? undefined,
        firstPaymentAmount: Number(customer.firstPaymentAmount),
        secondPaymentAmount: Number(customer.secondPaymentAmount),
        thirdPaymentAmount: Number(customer.thirdPaymentAmount),
        totalPaymentAmount: Number(customer.totalPaymentAmount),
        arrearsAmount: Number(customer.arrearsAmount),
      })),
      total,
      page,
      pageSize,
    }
  }

  async createOrder(
    currentUser: AuthenticatedUser,
    dto: CreateThirdSalesOrderDto,
    files?: {
      paymentScreenshot?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string }>
    },
  ) {
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        phone: dto.phone,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
    })
    if (!existingCustomer) {
      const exists = await this.prisma.customer.findUnique({ where: { phone: dto.phone }, select: { id: true } })
      if (exists) {
        throw new ForbiddenException('无权访问该客户')
      }
      throw new BadRequestException('客户不存在，请先录入一销')
    }

    await this.ensureThirdSalesUserWithinScope(currentUser, dto.thirdSalesUserId)

    const thirdSalesUser = await this.prisma.user.findUnique({ where: { id: dto.thirdSalesUserId } })
    if (!thirdSalesUser) {
      throw new NotFoundException('三销人员不存在')
    }

    const paymentAmount = this.parseAmount(dto.paymentAmount, '回款金额')
    const rawPerformanceAmount = paymentAmount
    const hearingCostAmount = await this.courtConfigService.getHearingCost()
    const performanceAmount = Math.max(rawPerformanceAmount - hearingCostAmount, 0)
    const paymentAccount = await this.paymentAccountsService.ensureAvailable(dto.paymentAccountId)
    await this.ensurePaymentSerialNoUnique(dto.paymentSerialNo)
    const paymentScreenshotUrl = files?.paymentScreenshot?.[0] ? `/uploads/${files.paymentScreenshot[0].filename}` : undefined
    const evidenceFileUrls = files?.evidenceFiles?.length
      ? JSON.stringify(files.evidenceFiles.map((file) => `/uploads/${file.filename}`))
      : dto.evidenceFileUrls
    const orderDate = this.resolveOrderDate(currentUser, dto.orderDate)
    const nextStatus = paymentAmount > 0 ? CustomerStatus.COMPLETED_THIRD_SALES : CustomerStatus.THIRD_SALES_FOLLOWING

    const createdOrderId = await this.prisma.$transaction(async (tx) => {
      const customer = existingCustomer

      const order = await tx.thirdSalesOrder.create({
        data: {
          customerId: customer.id,
          thirdSalesUserId: dto.thirdSalesUserId,
          sourceStage: customer.thirdSalesSourceStage ?? undefined,
          productName: dto.productName,
          paymentAmount,
          rawPerformanceAmount,
          hearingCostAmount,
          performanceAmount,
          paymentAccountId: paymentAccount.id,
          paymentAccountName: paymentAccount.accountName,
          paymentSerialNo: dto.paymentSerialNo,
          paymentScreenshotUrl,
          financeReviewStatus: FinanceReviewStatus.PENDING,
          orderDate,
          remark: dto.remark,
          evidenceFileUrls,
        },
      })

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          thirdSalesUserId: dto.thirdSalesUserId,
          currentOwnerId: dto.thirdSalesUserId,
          thirdPaymentAmount: { increment: paymentAmount },
          totalPaymentAmount: { increment: paymentAmount },
          currentStatus: nextStatus,
        },
      })

      return order.id
    })

    const notificationPayload = await this.dingTalkReportService.buildThirdSalesNotificationPayload(createdOrderId)
    if (notificationPayload) {
      await this.dingTalkReportService.notifyNewPerformance(notificationPayload)
    }

    return { success: true }
  }

  async updateOrder(
    currentUser: AuthenticatedUser,
    id: number,
    dto: CreateThirdSalesOrderDto,
    files?: {
      paymentScreenshot?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string }>
    },
  ) {
    const order = await this.prisma.thirdSalesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    })

    if (!order) {
      throw new NotFoundException('三销订单不存在')
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: order.customerId,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
    })

    if (!customer) {
      throw new ForbiddenException('无权访问该客户')
    }

    await this.ensureThirdSalesUserWithinScope(currentUser, dto.thirdSalesUserId)

    const thirdSalesUser = await this.prisma.user.findUnique({ where: { id: dto.thirdSalesUserId } })
    if (!thirdSalesUser) {
      throw new NotFoundException('三销人员不存在')
    }

    const paymentAmount = this.parseAmount(dto.paymentAmount, '回款金额')
    const rawPerformanceAmount = paymentAmount
    const hearingCostAmount = await this.courtConfigService.getHearingCost()
    const performanceAmount = Math.max(rawPerformanceAmount - hearingCostAmount, 0)
    const paymentAccount = await this.paymentAccountsService.ensureAvailable(dto.paymentAccountId)
    await this.ensurePaymentSerialNoUnique(dto.paymentSerialNo, { stage: 'THIRD', id })
    const paymentScreenshotUrl = files?.paymentScreenshot?.[0] ? `/uploads/${files.paymentScreenshot[0].filename}` : order.paymentScreenshotUrl
    const evidenceFileUrls = files?.evidenceFiles?.length
      ? JSON.stringify(files.evidenceFiles.map((file) => `/uploads/${file.filename}`))
      : order.evidenceFileUrls
    const orderDate = this.resolveOrderDate(currentUser, dto.orderDate, order.orderDate)
    const nextStatus = paymentAmount > 0 ? CustomerStatus.COMPLETED_THIRD_SALES : CustomerStatus.THIRD_SALES_FOLLOWING

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextThirdPaymentAmount = Number(customer.thirdPaymentAmount) - Number(order.paymentAmount) + paymentAmount
      const nextTotalPaymentAmount = Number(customer.totalPaymentAmount) - Number(order.paymentAmount) + paymentAmount

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          thirdSalesUserId: dto.thirdSalesUserId,
          currentOwnerId: dto.thirdSalesUserId,
          thirdPaymentAmount: nextThirdPaymentAmount,
          totalPaymentAmount: nextTotalPaymentAmount,
          currentStatus: nextStatus,
        },
      })

      return tx.thirdSalesOrder.update({
        where: { id },
        data: {
          thirdSalesUserId: dto.thirdSalesUserId,
          productName: dto.productName,
          paymentAmount,
          rawPerformanceAmount,
          hearingCostAmount,
          performanceAmount,
          paymentAccountId: paymentAccount.id,
          paymentAccountName: paymentAccount.accountName,
          paymentSerialNo: dto.paymentSerialNo,
          paymentScreenshotUrl,
          orderDate,
          remark: dto.remark,
          evidenceFileUrls,
          sourceStage: customer.thirdSalesSourceStage ?? order.sourceStage,
        },
        include: {
          customer: {
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
            },
          },
          thirdSalesUser: true,
          financeReviewer: true,
        },
      })
    })

    return this.mapOrder(updated)
  }

  async reviewOrder(currentUser: AuthenticatedUser, id: number, dto: FinanceReviewActionDto) {
    const order = await this.prisma.thirdSalesOrder.findUnique({
      where: { id },
      include: {
        customer: {
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
          },
        },
        thirdSalesUser: true,
        financeReviewer: true,
      },
    })

    if (!order) {
      throw new NotFoundException('三销订单不存在')
    }

    if (order.financeReviewStatus !== FinanceReviewStatus.PENDING) {
      throw new BadRequestException('仅待审核订单可处理')
    }

    const reviewer = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!reviewer) {
      throw new NotFoundException('审核人不存在')
    }

    const updated = await this.prisma.thirdSalesOrder.update({
      where: { id },
      data: {
        financeReviewStatus: this.resolveFinanceReviewStatus(dto.action),
        financeReviewerId: currentUser.id,
        financeReviewedAt: new Date(),
        financeReviewRemark: dto.remark,
      },
      include: {
        customer: {
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
          },
        },
        thirdSalesUser: true,
        financeReviewer: true,
      },
    })

    return this.mapOrder(updated)
  }

  async batchReviewOrders(currentUser: AuthenticatedUser, dto: BatchFinanceReviewDto) {
    const reviewer = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!reviewer) {
      throw new NotFoundException('审核人不存在')
    }

    const orders = await this.prisma.thirdSalesOrder.findMany({
      where: {
        id: { in: dto.orderIds },
      },
      include: {
        customer: {
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
          },
        },
        thirdSalesUser: true,
        financeReviewer: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const pendingOrderIds = orders.filter((item) => item.financeReviewStatus === FinanceReviewStatus.PENDING).map((item) => item.id)

    if (!pendingOrderIds.length) {
      throw new BadRequestException('未选择待审核订单')
    }

    await this.prisma.thirdSalesOrder.updateMany({
      where: {
        id: { in: pendingOrderIds },
      },
      data: {
        financeReviewStatus: this.resolveFinanceReviewStatus(dto.action),
        financeReviewerId: currentUser.id,
        financeReviewedAt: new Date(),
        financeReviewRemark: dto.remark,
      },
    })

    const updatedOrders = await this.prisma.thirdSalesOrder.findMany({
      where: {
        id: { in: pendingOrderIds },
      },
      include: {
        customer: {
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
          },
        },
        thirdSalesUser: true,
        financeReviewer: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return updatedOrders.map((order) => this.mapOrder(order))
  }

  private async ensureThirdSalesUserWithinScope(currentUser: AuthenticatedUser, thirdSalesUserId: number) {
    const where = await this.buildVisibilityWhere(currentUser)
    const targetOrder = await this.prisma.thirdSalesOrder.findFirst({
      where: {
        ...where,
        thirdSalesUserId,
      },
      select: { id: true },
    })

    if (targetOrder) {
      return
    }

    if (currentUser.reportScope === DataScope.ALL) {
      return
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: thirdSalesUserId },
      select: { id: true, departmentId: true },
    })

    if (!targetUser) {
      return
    }

    if (currentUser.reportScope === DataScope.SELF) {
      if (thirdSalesUserId !== currentUser.id) {
        throw new BadRequestException('无权将业绩归属给该三销人员')
      }
      return
    }

    if (!currentUser.departmentId || !targetUser.departmentId) {
      throw new BadRequestException('无权将业绩归属给该三销人员')
    }

    if (currentUser.reportScope === DataScope.DEPARTMENT) {
      if (targetUser.departmentId !== currentUser.departmentId) {
        throw new BadRequestException('无权将业绩归属给该三销人员')
      }
      return
    }

    if (currentUser.reportScope === DataScope.DEPARTMENT_AND_CHILDREN) {
      const allowedDepartmentIds = await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId)
      if (!allowedDepartmentIds.includes(targetUser.departmentId)) {
        throw new BadRequestException('无权将业绩归属给该三销人员')
      }
    }
  }

  private async buildVisibilityWhere(currentUser: AuthenticatedUser): Promise<Prisma.ThirdSalesOrderWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return {}
      case DataScope.SELF:
        return { thirdSalesUserId: currentUser.id }
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          thirdSalesUser: {
            departmentId: currentUser.departmentId,
          },
        }
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          thirdSalesUser: {
            departmentId: {
              in: await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId),
            },
          },
        }
      default:
        return { id: -1 }
    }
  }

  private resolveOrderDate(currentUser: AuthenticatedUser, input?: string, fallback?: Date | null) {
    if (!input) {
      return fallback ?? new Date()
    }

    if (!currentUser.permissions.includes(THIRD_SALES_TIME_EDIT_PERMISSION)) {
      return fallback ?? new Date()
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('录单时间格式不正确')
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

  private resolveFinanceReviewStatus(action: FinanceReviewActionTypeDto): FinanceReviewStatus {
    return action === FinanceReviewActionTypeDto.APPROVE ? FinanceReviewStatus.APPROVED : FinanceReviewStatus.REJECTED
  }

  private mapFinanceReviewStatus(status: FinanceReviewStatus) {
    const labels: Record<FinanceReviewStatus, string> = {
      PENDING: '待审核',
      APPROVED: '已通过',
      REJECTED: '已驳回',
    }

    return labels[status]
  }

  private parseEvidenceFileUrls(value?: string | null) {
    if (!value) {
      return []
    }

    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private parseAmount(value: string, fieldName: string) {
    const normalized = value.trim()
    if (!normalized) {
      throw new BadRequestException(`${fieldName}不能为空`)
    }

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new BadRequestException(`${fieldName}格式不正确`)
    }

    return Number(normalized)
  }

  private resolveFirstSalesTeamName(firstSalesUser?: { departmentInfo?: { name?: string | null; parent?: { name?: string | null } | null } | null } | null) {
    return firstSalesUser?.departmentInfo?.parent?.name || firstSalesUser?.departmentInfo?.name || undefined
  }

  private mapOrder(order: {
    id: number
    customerId: number
    sourceStage?: 'SECOND_SALES' | 'LEGAL' | null
    productName: string
    paymentAmount: Prisma.Decimal | number
    rawPerformanceAmount: Prisma.Decimal | number
    hearingCostAmount: Prisma.Decimal | number
    performanceAmount: Prisma.Decimal | number
    paymentAccountName?: string | null
    paymentAccountId?: number | null
    paymentSerialNo?: string | null
    paymentScreenshotUrl?: string | null
    remark?: string | null
    evidenceFileUrls?: string | null
    financeReviewStatus: FinanceReviewStatus
    financeReviewerId?: number | null
    financeReviewedAt?: Date | null
    financeReviewRemark?: string | null
    orderDate: Date
    createdAt: Date
    customer: {
      customerNo: string
      name: string
      phone: string
      firstSalesUser?: {
        departmentInfo?: {
          name?: string | null
          parent?: {
            name?: string | null
          } | null
        } | null
      } | null
    }
    thirdSalesUser: {
      realName: string
    }
    financeReviewer?: {
      realName: string
    } | null
  }) {
    return {
      id: order.id,
      customerId: order.customerId,
      customerNo: order.customer.customerNo,
      customerName: order.customer.name,
      phone: order.customer.phone,
      firstSalesTeamName: this.resolveFirstSalesTeamName(order.customer.firstSalesUser),
      thirdSalesUserName: order.thirdSalesUser.realName,
      sourceStage: order.sourceStage ?? undefined,
      productName: order.productName,
      paymentAmount: Number(order.paymentAmount),
      rawPerformanceAmount: Number(order.rawPerformanceAmount),
      hearingCostAmount: Number(order.hearingCostAmount),
      performanceAmount: Number(order.performanceAmount),
      paymentAccountName: order.paymentAccountName,
      paymentAccountId: order.paymentAccountId ?? undefined,
      paymentSerialNo: order.paymentSerialNo,
      paymentScreenshotUrl: this.filesService.toAccessUrl(order.paymentScreenshotUrl),
      remark: order.remark,
      evidenceFileUrls: this.filesService.toAccessUrls(this.parseEvidenceFileUrls(order.evidenceFileUrls)),
      financeReviewStatus: order.financeReviewStatus,
      financeReviewStatusLabel: this.mapFinanceReviewStatus(order.financeReviewStatus),
      financeReviewerId: order.financeReviewerId ?? undefined,
      financeReviewerName: order.financeReviewer?.realName,
      financeReviewedAt: order.financeReviewedAt ?? undefined,
      financeReviewRemark: order.financeReviewRemark ?? undefined,
      orderDate: order.orderDate,
      createdAt: order.createdAt,
    }
  }

  private generateCustomerNo() {
    const now = new Date()
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

    return `KH${datePart}${timePart}`
  }
}
