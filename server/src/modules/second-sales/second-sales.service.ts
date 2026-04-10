import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CustomerStatus, DataScope, FinanceReviewStatus, FirstOrderType, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { DepartmentsService } from '../departments/departments.service'
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service'
import { CourtConfigService } from '../court-config/court-config.service'
import { FilesService } from '../files/files.service'
import { BatchFinanceReviewDto } from '../first-sales/dto/batch-finance-review.dto'
import { FinanceReviewActionDto, FinanceReviewActionTypeDto } from '../first-sales/dto/finance-review-action.dto'
import { DingTalkReportService } from '../dingtalk-report/dingtalk-report.service'
import { QueryOrderListDto } from '../../common/dto/query-order-list.dto'
import { CreateSecondSalesOrderDto } from './dto/second-sales.dto'

@Injectable()
export class SecondSalesService {
  private readonly timeEditPermission = 'secondSales.time.edit'

  private async ensureLegalCaseExists(
    tx: Prisma.TransactionClient,
    customer: {
      id: number
      legalUserId: number | null
    },
    remark?: string,
    fallbackLegalUserId?: number,
  ) {
    const latestLegalCase = await tx.legalCase.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    })

    if (latestLegalCase) {
      return latestLegalCase
    }

    const legalUserId = customer.legalUserId ?? fallbackLegalUserId
    if (!legalUserId) {
      throw new BadRequestException('请先分配法务负责人后再转入法务')
    }

    return tx.legalCase.create({
      data: {
        customerId: customer.id,
        legalUserId,
        progressStatus: '待接案',
        caseResult: '',
        remark,
        startDate: new Date(),
        isCompleted: false,
        filingApproved: false,
        stage: 'ASSISTANT',
        assistantCollected: false,
        assistantDocumented: false,
        archiveNeeded: false,
        archiveCompleted: false,
        filingReviewed: false,
        transferredToPreTrial: false,
        closeResult: '',
        acceptedAt: new Date(),
      },
    })
  }

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

  async findOrders(currentUser: AuthenticatedUser, query?: QueryOrderListDto) {
    const page = query?.page ?? 1
    const pageSize = query?.pageSize ?? 30
    const skip = (page - 1) * pageSize
    const where = {
      ...(await this.buildVisibilityWhere(currentUser)),
      ...this.buildQueryWhere(query),
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.secondSalesOrder.findMany({
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
          secondSalesUser: true,
          financeReviewer: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.secondSalesOrder.count({ where }),
    ])

    return {
      items: orders.map((order) => this.mapOrder(order)),
      total,
      page,
      pageSize,
    }
  }

  private resolveOrderType(orderType: CreateSecondSalesOrderDto['orderType']) {
    return orderType as FirstOrderType
  }

  private resolvePaymentStatus(orderType: CreateSecondSalesOrderDto['orderType'], arrearsAmount: number) {
    if (orderType === 'DEPOSIT') {
      return 'PARTIAL'
    }

    return arrearsAmount > 0 ? 'PARTIAL' : 'PAID'
  }

  private resolveCurrentStatus(orderType: CreateSecondSalesOrderDto['orderType'], nextStage: CreateSecondSalesOrderDto['nextStage'], arrearsAmount: number) {
    if (orderType === 'DEPOSIT' || arrearsAmount > 0) {
      return CustomerStatus.SECOND_SALES_FOLLOWING
    }

    return nextStage === 'THIRD_SALES' ? CustomerStatus.PENDING_THIRD_SALES : CustomerStatus.PENDING_LEGAL
  }

  async createOrder(
    currentUser: AuthenticatedUser,
    dto: CreateSecondSalesOrderDto,
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      chatRecordFile?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string; originalname?: string }>
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

    await this.ensurePaymentSerialNoUnique(dto.paymentSerialNo)

    const paymentAccount = await this.paymentAccountsService.ensureAvailable(dto.paymentAccountId)
    const contractAmount = Number(dto.contractAmount)
    const secondPaymentAmount = Number(dto.secondPaymentAmount)
    const arrearsAmount = Math.max(contractAmount - secondPaymentAmount, 0)
    const orderType = this.resolveOrderType(dto.orderType)
    const paymentStatus = this.resolvePaymentStatus(dto.orderType, arrearsAmount)
    const hearingCostAmount = dto.includesHearing ? await this.courtConfigService.getHearingCost() : 0
    const performanceAmount = Math.max(secondPaymentAmount - hearingCostAmount, 0)
    const paymentScreenshotUrl = files.paymentScreenshot?.[0] ? `/uploads/${files.paymentScreenshot[0].filename}` : undefined
    const chatRecordUrl = files.chatRecordFile?.[0] ? `/uploads/${files.chatRecordFile[0].filename}` : undefined
    const evidenceFileUrls = files.evidenceFiles?.length
      ? JSON.stringify(files.evidenceFiles.map((file) => `/uploads/${file.filename}`))
      : undefined
    const orderDate = this.resolveOrderDate(currentUser, dto.orderDate)
    const nextStatus = this.resolveCurrentStatus(dto.orderType, dto.nextStage, arrearsAmount)

    if (!paymentScreenshotUrl) {
      throw new BadRequestException('请上传付款截图')
    }

    if (dto.orderType !== 'DEPOSIT' && !chatRecordUrl) {
      throw new BadRequestException('尾款或全款必须上传聊天记录截图')
    }

    const createdOrderId = await this.prisma.$transaction(async (tx) => {
      const customer = existingCustomer

      const order = await tx.secondSalesOrder.create({
        data: {
          customerId: customer.id,
          secondSalesUserId: dto.secondSalesUserId,
          orderType,
          secondPaymentAmount: dto.secondPaymentAmount,
          contractAmount,
          arrearsAmount,
          includesHearing: dto.includesHearing,
          hearingCostAmount,
          performanceAmount,
          paymentAccountId: paymentAccount.id,
          paymentAccountName: paymentAccount.accountName,
          paymentSerialNo: dto.paymentSerialNo,
          paymentScreenshotUrl,
          chatRecordUrl,
          evidenceFileUrls,
          paymentStatus,
          remark: dto.remark,
          financeReviewStatus: FinanceReviewStatus.PENDING,
          orderDate,
        },
      })

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          secondSalesUserId: dto.secondSalesUserId,
          currentOwnerId: nextStatus === CustomerStatus.PENDING_THIRD_SALES ? dto.secondSalesUserId : customer.legalUserId,
          secondPaymentAmount: { increment: dto.secondPaymentAmount },
          totalPaymentAmount: { increment: dto.secondPaymentAmount },
          arrearsAmount: Math.max(Number(customer.arrearsAmount) - dto.secondPaymentAmount, 0),
          currentStatus: nextStatus,
          thirdSalesSourceStage: nextStatus === CustomerStatus.PENDING_THIRD_SALES ? 'SECOND_SALES' : null,
        },
      })

      if (nextStatus === CustomerStatus.PENDING_LEGAL) {
        await this.ensureLegalCaseExists(tx, customer, dto.remark, dto.secondSalesUserId)
      }

      return order.id
    })

    const notificationPayload = await this.dingTalkReportService.buildSecondSalesNotificationPayload(createdOrderId)
    if (notificationPayload) {
      await this.dingTalkReportService.notifyNewPerformance(notificationPayload)
    }

    return { success: true }
  }

  async updateOrder(
    currentUser: AuthenticatedUser,
    id: number,
    dto: CreateSecondSalesOrderDto,
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      chatRecordFile?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string; originalname?: string }>
    },
  ) {
    const order = await this.prisma.secondSalesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    })

    if (!order) {
      throw new NotFoundException('二销订单不存在')
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

    const paymentAccount = await this.paymentAccountsService.ensureAvailable(dto.paymentAccountId)
    await this.ensurePaymentSerialNoUnique(dto.paymentSerialNo, { stage: 'SECOND', id })
    const contractAmount = Number(dto.contractAmount)
    const secondPaymentAmount = Number(dto.secondPaymentAmount)
    const arrearsAmount = Math.max(contractAmount - secondPaymentAmount, 0)
    const orderType = this.resolveOrderType(dto.orderType)
    const paymentStatus = this.resolvePaymentStatus(dto.orderType, arrearsAmount)
    const hearingCostAmount = dto.includesHearing ? await this.courtConfigService.getHearingCost() : 0
    const performanceAmount = Math.max(secondPaymentAmount - hearingCostAmount, 0)
    const paymentScreenshotUrl = files.paymentScreenshot?.[0] ? `/uploads/${files.paymentScreenshot[0].filename}` : order.paymentScreenshotUrl
    const chatRecordUrl = files.chatRecordFile?.[0] ? `/uploads/${files.chatRecordFile[0].filename}` : order.chatRecordUrl
    const evidenceFileUrls = files.evidenceFiles?.length
      ? JSON.stringify(files.evidenceFiles.map((file) => `/uploads/${file.filename}`))
      : order.evidenceFileUrls
    const orderDate = this.resolveOrderDate(currentUser, dto.orderDate, order.orderDate)
    const nextStatus = this.resolveCurrentStatus(dto.orderType, dto.nextStage, arrearsAmount)

    if (!paymentScreenshotUrl) {
      throw new BadRequestException('请上传付款截图')
    }

    if (dto.orderType !== 'DEPOSIT' && !chatRecordUrl) {
      throw new BadRequestException('尾款或全款必须上传聊天记录截图')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextSecondPaymentAmount = Number(customer.secondPaymentAmount) - Number(order.secondPaymentAmount) + secondPaymentAmount
      const nextTotalPaymentAmount = Number(customer.totalPaymentAmount) - Number(order.secondPaymentAmount) + secondPaymentAmount
      const nextCustomerArrearsAmount = Math.max(Number(customer.arrearsAmount) + Number(order.secondPaymentAmount) - secondPaymentAmount, 0)

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          secondSalesUserId: dto.secondSalesUserId,
          currentOwnerId: nextStatus === CustomerStatus.PENDING_THIRD_SALES ? dto.secondSalesUserId : customer.legalUserId,
          secondPaymentAmount: nextSecondPaymentAmount,
          totalPaymentAmount: nextTotalPaymentAmount,
          arrearsAmount: nextCustomerArrearsAmount,
          currentStatus: nextStatus,
          thirdSalesSourceStage: nextStatus === CustomerStatus.PENDING_THIRD_SALES ? 'SECOND_SALES' : null,
        },
      })

      if (nextStatus === CustomerStatus.PENDING_LEGAL) {
        await this.ensureLegalCaseExists(tx, customer, dto.remark, dto.secondSalesUserId)
      }

      return tx.secondSalesOrder.update({
        where: { id },
        data: {
          secondSalesUserId: dto.secondSalesUserId,
          orderType,
          secondPaymentAmount,
          contractAmount,
          arrearsAmount,
          includesHearing: dto.includesHearing,
          hearingCostAmount,
          performanceAmount,
          paymentAccountId: paymentAccount.id,
          paymentAccountName: paymentAccount.accountName,
          paymentSerialNo: dto.paymentSerialNo,
          paymentScreenshotUrl,
          chatRecordUrl,
          evidenceFileUrls,
          paymentStatus,
          remark: dto.remark,
          orderDate,
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
          secondSalesUser: true,
          financeReviewer: true,
        },
      })
    })

    return this.mapOrder(updated)
  }

  async reviewOrder(currentUser: AuthenticatedUser, id: number, dto: FinanceReviewActionDto) {
    const order = await this.prisma.secondSalesOrder.findUnique({
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
        secondSalesUser: true,
        financeReviewer: true,
      },
    })

    if (!order) {
      throw new NotFoundException('二销订单不存在')
    }

    if (order.financeReviewStatus !== FinanceReviewStatus.PENDING) {
      throw new BadRequestException('仅待审核订单可处理')
    }

    const reviewer = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!reviewer) {
      throw new NotFoundException('审核人不存在')
    }

    const updated = await this.prisma.secondSalesOrder.update({
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
        secondSalesUser: true,
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

    const orders = await this.prisma.secondSalesOrder.findMany({
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
        secondSalesUser: true,
        financeReviewer: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const pendingOrderIds = orders.filter((item) => item.financeReviewStatus === FinanceReviewStatus.PENDING).map((item) => item.id)

    if (!pendingOrderIds.length) {
      throw new BadRequestException('未选择待审核订单')
    }

    await this.prisma.secondSalesOrder.updateMany({
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

    const updatedOrders = await this.prisma.secondSalesOrder.findMany({
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
        secondSalesUser: true,
        financeReviewer: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return updatedOrders.map((order) => this.mapOrder(order))
  }

  async removeOrder(currentUser: AuthenticatedUser, id: number) {
    const order = await this.prisma.secondSalesOrder.findFirst({
      where: {
        id,
        ...(await this.buildVisibilityWhere(currentUser)),
      },
      include: {
        customer: true,
      },
    })

    if (!order) {
      const exists = await this.prisma.secondSalesOrder.findUnique({ where: { id }, select: { id: true } })
      if (exists) {
        throw new ForbiddenException('无权删除该二销订单')
      }
      throw new NotFoundException('二销订单不存在')
    }

    const nextSecondPaymentAmount = Math.max(Number(order.customer.secondPaymentAmount) - Number(order.secondPaymentAmount), 0)
    const nextTotalPaymentAmount = Math.max(Number(order.customer.totalPaymentAmount) - Number(order.secondPaymentAmount), 0)
    const nextArrearsAmount = Number(order.customer.arrearsAmount) + Number(order.secondPaymentAmount)

    await this.prisma.$transaction(async (tx) => {
      await tx.secondSalesOrder.delete({ where: { id: order.id } })
      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          secondPaymentAmount: nextSecondPaymentAmount,
          totalPaymentAmount: nextTotalPaymentAmount,
          arrearsAmount: nextArrearsAmount,
          currentStatus: CustomerStatus.SECOND_SALES_FOLLOWING,
          thirdSalesSourceStage: null,
        },
      })
    })

    return { success: true }
  }

  private buildQueryWhere(query?: QueryOrderListDto): Prisma.SecondSalesOrderWhereInput {
    const customerName = query?.customerName?.trim()
    const phone = query?.phone?.trim()
    const firstSalesUserName = query?.firstSalesUserName?.trim()
    const paymentAccountName = query?.paymentAccountName?.trim()
    const paymentSerialNo = query?.paymentSerialNo?.trim()
    const tailPaymentSerialNo = query?.tailPaymentSerialNo?.trim()
    const paymentStatus = query?.paymentStatus?.trim()

    return {
      ...(customerName
        ? {
            customer: {
              name: {
                contains: customerName,
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(phone
        ? {
            customer: {
              ...(customerName
                ? {
                    name: {
                      contains: customerName,
                      mode: 'insensitive',
                    },
                  }
                : {}),
              phone: {
                contains: phone,
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(firstSalesUserName
        ? {
            customer: {
              ...((customerName || phone)
                ? {
                    ...(customerName
                      ? {
                          name: {
                            contains: customerName,
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                    ...(phone
                      ? {
                          phone: {
                            contains: phone,
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  }
                : {}),
              firstSalesUser: {
                realName: {
                  contains: firstSalesUserName,
                  mode: 'insensitive',
                },
              },
            },
          }
        : {}),
      ...(paymentAccountName
        ? {
            paymentAccountName: {
              contains: paymentAccountName,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(paymentSerialNo
        ? {
            paymentSerialNo: {
              contains: paymentSerialNo,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(paymentStatus
        ? {
            paymentStatus,
          }
        : {}),
      ...(tailPaymentSerialNo
        ? {
            AND: [
              {
                orderType: FirstOrderType.TAIL,
              },
              {
                paymentSerialNo: {
                  contains: tailPaymentSerialNo,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    }
  }

  private resolveOrderDate(currentUser: AuthenticatedUser, input?: string, fallback?: Date | null) {
    if (!input) {
      return fallback ?? new Date()
    }

    if (!currentUser.permissions.includes(this.timeEditPermission)) {
      return fallback ?? new Date()
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('录单时间格式不正确')
    }

    return parsed
  }

  private async buildVisibilityWhere(currentUser: AuthenticatedUser): Promise<Prisma.SecondSalesOrderWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return {}
      case DataScope.SELF:
        return { secondSalesUserId: currentUser.id }
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          secondSalesUser: {
            departmentId: currentUser.departmentId,
          },
        }
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          secondSalesUser: {
            departmentId: {
              in: await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId),
            },
          },
        }
      default:
        return { id: -1 }
    }
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

  private mapOrderType(orderType?: FirstOrderType | null) {
    const labels: Record<FirstOrderType, string> = {
      DEPOSIT: '定金',
      TAIL: '尾款',
      FULL: '全款',
    }

    return labels[orderType ?? FirstOrderType.FULL]
  }

  private mapPaymentStatus(status?: string | null) {
    if (status === 'PAID') {
      return '已付清'
    }

    return '部分付款'
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

  private resolveFirstSalesTeamName(firstSalesUser?: { departmentInfo?: { name?: string | null; parent?: { name?: string | null } | null } | null } | null) {
    return firstSalesUser?.departmentInfo?.parent?.name || firstSalesUser?.departmentInfo?.name || undefined
  }

  private mapOrder(order: {
    id: number
    customerId: number
    secondPaymentAmount: Prisma.Decimal | number
    orderType: FirstOrderType
    contractAmount: Prisma.Decimal | number
    arrearsAmount: Prisma.Decimal | number
    includesHearing: boolean
    hearingCostAmount: Prisma.Decimal | number
    performanceAmount: Prisma.Decimal | number
    paymentAccountName?: string | null
    paymentAccountId?: number | null
    paymentSerialNo?: string | null
    paymentScreenshotUrl?: string | null
    chatRecordUrl?: string | null
    evidenceFileUrls?: string | null
    paymentStatus?: string | null
    remark?: string | null
    financeReviewStatus: FinanceReviewStatus
    financeReviewerId?: number | null
    financeReviewedAt?: Date | null
    financeReviewRemark?: string | null
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
    secondSalesUser: {
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
      secondSalesUserName: order.secondSalesUser.realName,
      orderType: this.mapOrderType(order.orderType),
      contractAmount: Number(order.contractAmount),
      secondPaymentAmount: Number(order.secondPaymentAmount),
      arrearsAmount: Number(order.arrearsAmount),
      includesHearing: order.includesHearing,
      hearingCostAmount: Number(order.hearingCostAmount),
      performanceAmount: Number(order.performanceAmount),
      paymentAccountName: order.paymentAccountName,
      paymentAccountId: order.paymentAccountId ?? undefined,
      paymentSerialNo: order.paymentSerialNo,
      paymentScreenshotUrl: this.filesService.toAccessUrl(order.paymentScreenshotUrl),
      chatRecordUrl: this.filesService.toAccessUrl(order.chatRecordUrl),
      evidenceFileUrls: this.filesService.toAccessUrls(this.parseEvidenceFileUrls(order.evidenceFileUrls)),
      paymentStatus: this.mapPaymentStatus(order.paymentStatus),
      remark: order.remark ?? undefined,
      financeReviewStatus: order.financeReviewStatus,
      financeReviewStatusLabel: this.mapFinanceReviewStatus(order.financeReviewStatus),
      financeReviewerId: order.financeReviewerId ?? undefined,
      financeReviewerName: order.financeReviewer?.realName,
      financeReviewedAt: order.financeReviewedAt ?? undefined,
      financeReviewRemark: order.financeReviewRemark ?? undefined,
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
