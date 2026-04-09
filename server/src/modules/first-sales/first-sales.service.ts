import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { CustomerStatus, DataScope, FinanceReviewStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service'
import { FilesService } from '../files/files.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CreateFirstSalesOrderDto, FirstOrderTypeDto } from './dto/create-first-sales-order.dto'
import { CreateFirstSalesTailOrderDto } from './dto/create-first-sales-tail-order.dto'
import { FinanceReviewActionDto, FinanceReviewActionTypeDto } from './dto/finance-review-action.dto'
import { BatchFinanceReviewDto } from './dto/batch-finance-review.dto'
import { DingTalkReportService } from '../dingtalk-report/dingtalk-report.service'
import { QueryOrderListDto } from '../../common/dto/query-order-list.dto'

const FIRST_SALES_ROLE_CODES = ['SUPER_ADMIN', 'FIRST_SALES_MANAGER', 'FIRST_SALES_SUPERVISOR', 'FIRST_SALES']
const FIRST_SALES_TIME_EDIT_PERMISSION = 'firstSales.time.edit'

@Injectable()
export class FirstSalesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
    private readonly paymentAccountsService: PaymentAccountsService,
    private readonly dingTalkReportService: DingTalkReportService,
    private readonly filesService: FilesService,
  ) {}

  async onModuleInit() {
    await this.backfillCustomersFromFirstSalesOrders()
  }

  async createOrder(
    currentUser: AuthenticatedUser,
    dto: CreateFirstSalesOrderDto,
    files: {
      paymentScreenshot?: { filename: string }
      chatRecordFile?: { filename: string }
      evidenceImages: Array<{ filename: string }>
    },
  ) {
    await this.ensureSalesUserWithinScope(currentUser, dto.salesUserId)

    await this.ensurePaymentSerialNoUnique(dto.paymentSerialNo)

    const salesUser = await this.prisma.user.findUnique({
      where: { id: dto.salesUserId },
    })

    if (!salesUser) {
      throw new NotFoundException('一销人员不存在')
    }

    const paymentAccount = await this.paymentAccountsService.ensureAvailable(dto.paymentAccountId)
    const paymentAmount = Number(dto.paymentAmount)
    const arrearsAmount = Number(dto.arrearsAmount)
    const contractAmount = Number(dto.contractAmount)
    const targetAmount = Number(dto.targetAmount)
    const isTimelyDeal = dto.isTimelyDeal === 'true'
    const orderType = dto.orderType as keyof typeof FirstOrderTypeDto
    const paymentScreenshotUrl = files.paymentScreenshot ? `/uploads/${files.paymentScreenshot.filename}` : undefined
    const chatRecordUrl = files.chatRecordFile ? `/uploads/${files.chatRecordFile.filename}` : undefined
    const evidenceImageUrls = files.evidenceImages.length ? JSON.stringify(files.evidenceImages.map((file) => `/uploads/${file.filename}`)) : undefined
    const orderDate = this.resolveOrderDate(currentUser, dto.orderDate)

    const result = await this.prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findUnique({
        where: { phone: dto.phone },
      })

      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: dto.customerName,
              wechat: dto.wechat,
              gender: dto.gender,
              age: dto.age,
              province: dto.province,
              city: dto.city,
              source: dto.source,
              caseType: dto.caseType,
              intentionLevel: dto.intentionLevel,
              firstSalesUserId: dto.salesUserId,
              currentOwnerId: dto.salesUserId,
              targetAmount,
              firstPaymentAmount: { increment: paymentAmount },
              totalPaymentAmount: { increment: paymentAmount },
              arrearsAmount,
              isTailPaymentCompleted: arrearsAmount === 0,
              currentStatus: this.resolveCustomerStatus(arrearsAmount),
              firstSalesChatRecordUrl: chatRecordUrl ?? existingCustomer.firstSalesChatRecordUrl,
              remark: dto.remark,
            },
          })
        : await tx.customer.create({
            data: {
              customerNo: this.generateCustomerNo(),
              name: dto.customerName,
              phone: dto.phone,
              wechat: dto.wechat,
              gender: dto.gender,
              age: dto.age,
              province: dto.province,
              city: dto.city,
              source: dto.source,
              caseType: dto.caseType,
              intentionLevel: dto.intentionLevel,
              firstSalesUserId: dto.salesUserId,
              currentOwnerId: dto.salesUserId,
              targetAmount,
              firstPaymentAmount: paymentAmount,
              totalPaymentAmount: paymentAmount,
              arrearsAmount,
              isTailPaymentCompleted: arrearsAmount === 0,
              currentStatus: this.resolveCustomerStatus(arrearsAmount),
              firstSalesChatRecordUrl: chatRecordUrl,
              remark: dto.remark,
            },
          })

      const order = await tx.firstSalesOrder.create({
        data: {
          customerId: customer.id,
          salesUserId: dto.salesUserId,
          orderType,
          isTimelyDeal,
          targetAmount,
          contractAmount,
          paymentAmount,
          arrearsAmount,
          paymentAccountId: paymentAccount.id,
          paymentAccountName: paymentAccount.accountName,
          paymentSerialNo: dto.paymentSerialNo,
          paymentScreenshotUrl,
          chatRecordUrl,
          evidenceImageUrls,
          paymentStatus: arrearsAmount === 0 ? 'PAID' : 'PARTIAL',
          orderDate,
          remark: dto.remark,
        },
      })

      return {
        id: order.id,
        customerId: customer.id,
        customerNo: customer.customerNo,
        currentStatus: customer.currentStatus,
      }
    })

    const notificationPayload = await this.dingTalkReportService.buildFirstSalesNotificationPayload(result.id)
    if (notificationPayload) {
      await this.dingTalkReportService.notifyNewPerformance(notificationPayload)
    }

    return result
  }

  async createTailOrder(
    currentUser: AuthenticatedUser,
    customerId: number,
    dto: CreateFirstSalesTailOrderDto,
    files: {
      paymentScreenshot?: { filename: string }
      chatRecordFile?: { filename: string }
      evidenceImages: Array<{ filename: string }>
    },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      throw new NotFoundException('客户不存在')
    }

    await this.ensureSalesUserWithinScope(currentUser, dto.salesUserId)

    const salesUser = await this.prisma.user.findUnique({
      where: { id: dto.salesUserId },
    })

    if (!salesUser) {
      throw new NotFoundException('一销人员不存在')
    }

    const paymentAccount = await this.paymentAccountsService.ensureAvailable(dto.paymentAccountId)
    await this.ensurePaymentSerialNoUnique(dto.paymentSerialNo)
    const paymentAmount = Number(dto.paymentAmount)
    const targetAmount = Number(dto.targetAmount)
    const arrearsAmount = Number(dto.arrearsAmount)
    const isTimelyDeal = dto.isTimelyDeal === 'true'
    const paymentScreenshotUrl = files.paymentScreenshot ? `/uploads/${files.paymentScreenshot.filename}` : undefined
    const chatRecordUrl = files.chatRecordFile ? `/uploads/${files.chatRecordFile.filename}` : undefined
    const evidenceImageUrls = files.evidenceImages.length ? JSON.stringify(files.evidenceImages.map((file) => `/uploads/${file.filename}`)) : undefined
    const orderDate = this.resolveOrderDate(currentUser, dto.orderDate)

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstSalesUserId: dto.salesUserId,
        currentOwnerId: dto.salesUserId,
        targetAmount,
        firstPaymentAmount: { increment: paymentAmount },
        totalPaymentAmount: { increment: paymentAmount },
        arrearsAmount,
        isTailPaymentCompleted: arrearsAmount === 0,
        currentStatus: this.resolveCustomerStatus(arrearsAmount),
        firstSalesChatRecordUrl: chatRecordUrl ?? customer.firstSalesChatRecordUrl,
        remark: dto.remark,
      },
    })

    const order = await this.createFirstSalesOrderRecord({
      customerId,
      salesUserId: dto.salesUserId,
      orderType: FirstOrderTypeDto.TAIL,
      isTimelyDeal,
      targetAmount,
      contractAmount: Number(dto.contractAmount),
      paymentAmount,
      arrearsAmount,
      paymentAccountId: paymentAccount.id,
      paymentAccountName: paymentAccount.accountName,
      paymentSerialNo: dto.paymentSerialNo,
      paymentScreenshotUrl,
      chatRecordUrl,
      evidenceImageUrls,
      orderDate,
      remark: dto.remark,
    })

    const notificationPayload = await this.dingTalkReportService.buildFirstSalesNotificationPayload(order.id)
    if (notificationPayload) {
      await this.dingTalkReportService.notifyNewPerformance(notificationPayload)
    }

    const updatedCustomer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    })

    return {
      id: order.id,
      customerId,
      customerNo: updatedCustomer?.customerNo || customer.customerNo,
      currentStatus: updatedCustomer?.currentStatus || customer.currentStatus,
    }
  }

  async updateOrder(
    currentUser: AuthenticatedUser,
    id: number,
    dto: CreateFirstSalesOrderDto,
    files: {
      paymentScreenshot?: { filename: string }
      chatRecordFile?: { filename: string }
      evidenceImages: Array<{ filename: string }>
    },
  ) {
    const order = await this.prisma.firstSalesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    })

    if (!order) {
      throw new NotFoundException('一销订单不存在')
    }

    await this.ensureSalesUserWithinScope(currentUser, dto.salesUserId)

    const salesUser = await this.prisma.user.findUnique({
      where: { id: dto.salesUserId },
    })

    if (!salesUser) {
      throw new NotFoundException('一销人员不存在')
    }

    const paymentAccount = await this.paymentAccountsService.ensureAvailable(dto.paymentAccountId)
    const paymentAmount = Number(dto.paymentAmount)
    const arrearsAmount = Number(dto.arrearsAmount)
    const contractAmount = Number(dto.contractAmount)
    const targetAmount = Number(dto.targetAmount)
    const isTimelyDeal = dto.isTimelyDeal === 'true'
    const orderType = dto.orderType as keyof typeof FirstOrderTypeDto
    const paymentScreenshotUrl = files.paymentScreenshot ? `/uploads/${files.paymentScreenshot.filename}` : order.paymentScreenshotUrl
    const chatRecordUrl = files.chatRecordFile ? `/uploads/${files.chatRecordFile.filename}` : order.customer.firstSalesChatRecordUrl
    const evidenceImageUrls = files.evidenceImages.length
      ? JSON.stringify(files.evidenceImages.map((file) => `/uploads/${file.filename}`))
      : order.evidenceImageUrls
    const orderDate = this.resolveOrderDate(currentUser, dto.orderDate, order.orderDate)

    const existingCustomerByPhone = await this.prisma.customer.findUnique({
      where: { phone: dto.phone },
      select: { id: true },
    })

    if (existingCustomerByPhone && existingCustomerByPhone.id !== order.customerId) {
      throw new BadRequestException('该手机号已绑定其他客户')
    }

    await this.ensurePaymentSerialNoUnique(dto.paymentSerialNo, { stage: 'FIRST', id })

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextTotalPaymentAmount = Number(order.customer.totalPaymentAmount) - Number(order.paymentAmount) + paymentAmount
      const nextFirstPaymentAmount = Number(order.customer.firstPaymentAmount) - Number(order.paymentAmount) + paymentAmount

      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          name: dto.customerName,
          phone: dto.phone,
          wechat: dto.wechat,
          gender: dto.gender,
          age: dto.age,
          province: dto.province,
          city: dto.city,
          source: dto.source,
          caseType: dto.caseType,
          intentionLevel: dto.intentionLevel,
          firstSalesUserId: dto.salesUserId,
          currentOwnerId: dto.salesUserId,
          targetAmount,
          firstPaymentAmount: nextFirstPaymentAmount,
          totalPaymentAmount: nextTotalPaymentAmount,
          arrearsAmount,
          isTailPaymentCompleted: arrearsAmount === 0,
          currentStatus: this.resolveCustomerStatus(arrearsAmount),
          firstSalesChatRecordUrl: chatRecordUrl,
          remark: dto.remark,
        },
      })

      return tx.firstSalesOrder.update({
        where: { id },
        data: {
          salesUserId: dto.salesUserId,
          orderType,
          isTimelyDeal,
          targetAmount,
          contractAmount,
          paymentAmount,
          arrearsAmount,
          paymentAccountId: paymentAccount.id,
          paymentAccountName: paymentAccount.accountName,
          paymentSerialNo: dto.paymentSerialNo,
          paymentScreenshotUrl,
          chatRecordUrl,
          evidenceImageUrls,
          paymentStatus: arrearsAmount === 0 ? 'PAID' : 'PARTIAL',
          orderDate,
          remark: dto.remark,
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
          salesUser: true,
          financeReviewer: true,
          paymentAccount: true,
        },
      })
    })

    return this.mapOrder(updated)
  }

  async removeOrder(currentUser: AuthenticatedUser, id: number) {
    const order = await this.prisma.firstSalesOrder.findFirst({
      where: {
        id,
        ...(await this.buildVisibilityWhere(currentUser)),
      },
      include: {
        customer: {
          include: {
            firstSalesOrders: {
              select: {
                id: true,
                paymentAmount: true,
                arrearsAmount: true,
                targetAmount: true,
                salesUserId: true,
                chatRecordUrl: true,
                createdAt: true,
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            },
          },
        },
      },
    })

    if (!order) {
      const exists = await this.prisma.firstSalesOrder.findUnique({ where: { id }, select: { id: true } })
      if (exists) {
        throw new ForbiddenException('无权删除该一销订单')
      }
      throw new NotFoundException('一销订单不存在')
    }

    const remainingOrders = order.customer.firstSalesOrders.filter((item) => item.id !== order.id)
    const nextFirstPaymentAmount = remainingOrders.reduce((sum, item) => sum + Number(item.paymentAmount), 0)
    const nextArrearsAmount = remainingOrders.length ? Number(remainingOrders[remainingOrders.length - 1].arrearsAmount) : 0
    const latestOrder = remainingOrders[0]
    const latestChatRecordUrl = remainingOrders.find((item) => item.chatRecordUrl)?.chatRecordUrl || null
    const nextTargetAmount = latestOrder ? Number(latestOrder.targetAmount) : 0
    const nextFirstSalesUserId = latestOrder?.salesUserId ?? null
    const nextTotalPaymentAmount = Math.max(Number(order.customer.totalPaymentAmount) - Number(order.paymentAmount), 0)

    await this.prisma.$transaction(async (tx) => {
      await tx.firstSalesOrder.delete({ where: { id: order.id } })
      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          firstSalesUserId: nextFirstSalesUserId,
          currentOwnerId: nextFirstSalesUserId,
          targetAmount: nextTargetAmount,
          firstPaymentAmount: nextFirstPaymentAmount,
          totalPaymentAmount: nextTotalPaymentAmount,
          arrearsAmount: nextArrearsAmount,
          isTailPaymentCompleted: nextArrearsAmount === 0,
          currentStatus: this.resolveCustomerStatus(nextArrearsAmount),
          firstSalesChatRecordUrl: latestChatRecordUrl,
        },
      })
    })

    return { success: true }
  }

  async findOrders(currentUser: AuthenticatedUser, query?: QueryOrderListDto) {
    const where = {
      ...(await this.buildVisibilityWhere(currentUser)),
      ...this.buildQueryWhere(query),
    }

    const orders = await this.prisma.firstSalesOrder.findMany({
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
        salesUser: true,
        financeReviewer: true,
        paymentAccount: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return orders.map((order) => this.mapOrder(order))
  }

  async reviewOrder(currentUser: AuthenticatedUser, id: number, dto: FinanceReviewActionDto) {
    const order = await this.prisma.firstSalesOrder.findUnique({
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
        salesUser: true,
        financeReviewer: true,
        paymentAccount: true,
      },
    })

    if (!order) {
      throw new NotFoundException('一销订单不存在')
    }

    if (order.financeReviewStatus !== FinanceReviewStatus.PENDING) {
      throw new BadRequestException('仅待审核订单可处理')
    }

    const reviewer = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!reviewer) {
      throw new NotFoundException('审核人不存在')
    }

    const updated = await this.prisma.firstSalesOrder.update({
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
        salesUser: true,
        financeReviewer: true,
        paymentAccount: true,
      },
    })

    return this.mapOrder(updated)
  }

  async batchReviewOrders(currentUser: AuthenticatedUser, dto: BatchFinanceReviewDto) {
    const reviewer = await this.prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!reviewer) {
      throw new NotFoundException('审核人不存在')
    }

    const orders = await this.prisma.firstSalesOrder.findMany({
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
        salesUser: true,
        financeReviewer: true,
        paymentAccount: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const pendingOrderIds = orders.filter((item) => item.financeReviewStatus === FinanceReviewStatus.PENDING).map((item) => item.id)

    if (!pendingOrderIds.length) {
      throw new BadRequestException('未选择待审核订单')
    }

    await this.prisma.firstSalesOrder.updateMany({
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

    const updatedOrders = await this.prisma.firstSalesOrder.findMany({
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
        salesUser: true,
        financeReviewer: true,
        paymentAccount: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return updatedOrders.map((order) => this.mapOrder(order))
  }

  async findSalesUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        role: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    return users
      .filter((user) => FIRST_SALES_ROLE_CODES.includes(user.role.code))
      .map((user) => ({
        id: user.id,
        realName: user.realName,
        roleName: user.role.name,
      }))
  }

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

  private async buildVisibilityWhere(currentUser: AuthenticatedUser): Promise<Prisma.FirstSalesOrderWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return {}
      case DataScope.SELF:
        return { salesUserId: currentUser.id }
      case DataScope.DEPARTMENT:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          salesUser: {
            departmentId: currentUser.departmentId,
          },
        }
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return { id: -1 }
        }
        return {
          salesUser: {
            departmentId: {
              in: await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId),
            },
          },
        }
      default:
        return { id: -1 }
    }
  }

  private buildQueryWhere(query?: QueryOrderListDto): Prisma.FirstSalesOrderWhereInput {
    const paymentAccountName = query?.paymentAccountName?.trim()
    const paymentSerialNo = query?.paymentSerialNo?.trim()
    const tailPaymentSerialNo = query?.tailPaymentSerialNo?.trim()

    return {
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
      ...(tailPaymentSerialNo
        ? {
            AND: [
              {
                orderType: FirstOrderTypeDto.TAIL,
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

  private async ensureSalesUserWithinScope(currentUser: AuthenticatedUser, salesUserId: number) {
    const where = await this.buildVisibilityWhere(currentUser)
    const salesUser = await this.prisma.firstSalesOrder.findFirst({
      where: {
        ...where,
        salesUserId,
      },
      select: { id: true },
    })

    if (salesUser) {
      return
    }

    if (currentUser.reportScope === DataScope.ALL) {
      return
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: salesUserId },
      select: { id: true, departmentId: true },
    })

    if (!targetUser) {
      return
    }

    if (currentUser.reportScope === DataScope.SELF) {
      if (salesUserId !== currentUser.id) {
        throw new BadRequestException('无权将业绩归属给该一销人员')
      }
      return
    }

    if (!currentUser.departmentId || !targetUser.departmentId) {
      throw new BadRequestException('无权将业绩归属给该一销人员')
    }

    if (currentUser.reportScope === DataScope.DEPARTMENT) {
      if (targetUser.departmentId !== currentUser.departmentId) {
        throw new BadRequestException('无权将业绩归属给该一销人员')
      }
      return
    }

    if (currentUser.reportScope === DataScope.DEPARTMENT_AND_CHILDREN) {
      const allowedDepartmentIds = await this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId)
      if (!allowedDepartmentIds.includes(targetUser.departmentId)) {
        throw new BadRequestException('无权将业绩归属给该一销人员')
      }
    }
  }

  private async backfillCustomersFromFirstSalesOrders() {
    const invalidOrders = await this.prisma.$queryRaw<Array<{ id: number; customerId: number }>>`
      SELECT o."id", o."customerId"
      FROM "FirstSalesOrder" o
      LEFT JOIN "Customer" c ON c."id" = o."customerId"
      WHERE c."id" IS NULL
      LIMIT 20
    `

    if (invalidOrders.length) {
      throw new NotFoundException(`检测到 ${invalidOrders.length} 条一销业绩缺少客户档案关联，请先修复历史脏数据`)
    }
  }

  private createFirstSalesOrderRecord(params: {
    customerId: number
    salesUserId: number
    orderType: keyof typeof FirstOrderTypeDto
    isTimelyDeal: boolean
    targetAmount: number
    contractAmount: number
    paymentAmount: number
    arrearsAmount: number
    paymentAccountId: number
    paymentAccountName: string
    paymentSerialNo: string
    paymentScreenshotUrl?: string
    chatRecordUrl?: string
    evidenceImageUrls?: string
    orderDate?: Date
    remark?: string
  }) {
    return this.prisma.firstSalesOrder.create({
      data: {
        customerId: params.customerId,
        salesUserId: params.salesUserId,
        orderType: params.orderType,
        isTimelyDeal: params.isTimelyDeal,
        targetAmount: params.targetAmount,
        contractAmount: params.contractAmount,
        paymentAmount: params.paymentAmount,
        arrearsAmount: params.arrearsAmount,
        paymentAccountId: params.paymentAccountId,
        paymentAccountName: params.paymentAccountName,
        paymentSerialNo: params.paymentSerialNo,
        paymentScreenshotUrl: params.paymentScreenshotUrl,
        chatRecordUrl: params.chatRecordUrl,
        evidenceImageUrls: params.evidenceImageUrls,
        paymentStatus: params.arrearsAmount === 0 ? 'PAID' : 'PARTIAL',
        orderDate: params.orderDate ?? new Date(),
        remark: params.remark,
      },
    })
  }

  private resolveCustomerStatus(arrearsAmount: number): CustomerStatus {
    return arrearsAmount > 0 ? CustomerStatus.PENDING_TAIL_PAYMENT : CustomerStatus.PENDING_SECOND_SALES_ASSIGNMENT
  }

  private resolveOrderDate(currentUser: AuthenticatedUser, input?: string, fallback?: Date | null) {
    if (!input) {
      return fallback ?? new Date()
    }

    if (!currentUser.permissions.includes(FIRST_SALES_TIME_EDIT_PERMISSION)) {
      return fallback ?? new Date()
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('录单时间格式不正确')
    }

    return parsed
  }

  private mapOrderType(orderType: keyof typeof FirstOrderTypeDto) {
    const labels: Record<keyof typeof FirstOrderTypeDto, string> = {
      DEPOSIT: '定金',
      TAIL: '尾款',
      FULL: '全款',
    }

    return labels[orderType]
  }

  private mapPaymentStatus(status?: string | null) {
    if (status === 'PAID') {
      return '已付清'
    }

    if (status === 'PARTIAL') {
      return '部分付款'
    }

    return status || '-'
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

  private parseEvidenceImageUrls(value?: string | null) {
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

  private resolveFirstSalesTeamName(firstSalesUser?: { departmentInfo?: { id?: number | null; name?: string | null; parent?: { name?: string | null } | null } | null } | null) {
    return firstSalesUser?.departmentInfo?.parent?.name || firstSalesUser?.departmentInfo?.name || undefined
  }

  private resolveFirstSalesDepartmentId(firstSalesUser?: { departmentInfo?: { id?: number | null } | null } | null) {
    return firstSalesUser?.departmentInfo?.id || undefined
  }

  private resolveFirstSalesDepartmentName(firstSalesUser?: { departmentInfo?: { name?: string | null } | null } | null) {
    return firstSalesUser?.departmentInfo?.name || undefined
  }

  private mapOrder(order: {
    id: number
    orderType: keyof typeof FirstOrderTypeDto
    isTimelyDeal: boolean
    targetAmount: Prisma.Decimal | number | null
    contractAmount: Prisma.Decimal | number
    paymentAmount: Prisma.Decimal | number
    arrearsAmount: Prisma.Decimal | number
    paymentAccountName?: string | null
    paymentAccountId?: number | null
    paymentSerialNo?: string | null
    paymentScreenshotUrl?: string | null
    chatRecordUrl?: string | null
    evidenceImageUrls?: string | null
    paymentStatus?: string | null
    financeReviewStatus: FinanceReviewStatus
    financeReviewerId?: number | null
    financeReviewedAt?: Date | null
    financeReviewRemark?: string | null
    remark?: string | null
    createdAt: Date
    customer: {
      id: number
      customerNo: string
      name: string
      phone: string
      wechat?: string | null
      province?: string | null
      city?: string | null
      source?: string | null
      caseType?: string | null
      intentionLevel?: string | null
      currentStatus: CustomerStatus
      firstSalesUser?: {
        departmentInfo?: {
          id?: number | null
          name?: string | null
          parent?: {
            name?: string | null
          } | null
        } | null
      } | null
    }
    salesUser: {
      realName: string
    }
    financeReviewer?: {
      realName: string
    } | null
  }) {
    return {
      id: order.id,
      customerId: order.customer.id,
      customerNo: order.customer.customerNo,
      name: order.customer.name,
      phone: order.customer.phone,
      wechat: order.customer.wechat,
      province: order.customer.province,
      city: order.customer.city,
      source: order.customer.source,
      caseType: order.customer.caseType,
      intentionLevel: order.customer.intentionLevel,
      orderType: this.mapOrderType(order.orderType),
      isTimelyDeal: order.isTimelyDeal,
      targetAmount: Number(order.targetAmount ?? 0),
      contractAmount: Number(order.contractAmount),
      paymentAmount: Number(order.paymentAmount),
      arrearsAmount: Number(order.arrearsAmount),
      paymentAccountName: order.paymentAccountName,
      paymentAccountId: order.paymentAccountId,
      paymentSerialNo: order.paymentSerialNo,
      paymentScreenshotUrl: this.filesService.toAccessUrl(order.paymentScreenshotUrl),
      chatRecordUrl: this.filesService.toAccessUrl(order.chatRecordUrl),
      evidenceImageUrls: this.filesService.toAccessUrls(this.parseEvidenceImageUrls(order.evidenceImageUrls)),
      paymentStatus: this.mapPaymentStatus(order.paymentStatus),
      currentStatus: this.mapCustomerStatus(order.customer.currentStatus),
      salesUserName: order.salesUser.realName,
      firstSalesDepartmentId: this.resolveFirstSalesDepartmentId(order.customer.firstSalesUser),
      firstSalesTeamName: this.resolveFirstSalesTeamName(order.customer.firstSalesUser),
      firstSalesDepartmentName: this.resolveFirstSalesDepartmentName(order.customer.firstSalesUser),
      financeReviewStatus: order.financeReviewStatus,
      financeReviewStatusLabel: this.mapFinanceReviewStatus(order.financeReviewStatus),
      financeReviewerId: order.financeReviewerId ?? undefined,
      financeReviewerName: order.financeReviewer?.realName,
      financeReviewedAt: order.financeReviewedAt ?? undefined,
      financeReviewRemark: order.financeReviewRemark ?? undefined,
      remark: order.remark,
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
