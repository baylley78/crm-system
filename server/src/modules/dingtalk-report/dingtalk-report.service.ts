import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateDingTalkReportConfigDto } from './dto/create-dingtalk-report-config.dto'
import { UpdateDingTalkReportConfigDto } from './dto/update-dingtalk-report-config.dto'

type PerformanceStage = '一销业绩' | '二销业绩' | '三销业绩'
type DingTalkReportTemplateType = 'FIRST_SALES' | 'LITIGATION'

type PerformanceNotificationPayload = {
  stage: PerformanceStage
  customerName: string
  phone: string
  maskedPhone?: string
  salesName: string
  departmentId?: number | null
  departmentName?: string | null
  teamName?: string | null
  branchName?: string | null
  groupName?: string | null
  paymentAmount: number
  performanceAmount: number
  orderTime: Date
  orderType?: string
  isTimelyDeal?: string
  dailyOrderCount?: number
  dailyPaymentAmount?: number
  departmentDailyPerformanceLines?: string
  departmentDailyPerformanceTotal?: number
}

@Injectable()
export class DingTalkReportService {
  private readonly logger = new Logger(DingTalkReportService.name)

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const configs = await this.prisma.dingTalkReportConfig.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    return configs.map((item) => this.serializeConfig(item))
  }

  async create(dto: CreateDingTalkReportConfigDto) {
    await this.ensureDepartments(dto.departmentIds)
    const created = await this.prisma.dingTalkReportConfig.create({
      data: {
        templateType: dto.templateType,
        departmentIds: JSON.stringify(dto.departmentIds),
        departmentNames: JSON.stringify(dto.departmentNames),
        webhookUrl: dto.webhookUrl,
        dailyTarget: dto.dailyTarget,
        messageTemplate: dto.messageTemplate,
        isActive: dto.isActive ?? true,
      },
    })

    return this.serializeConfig(created)
  }

  async update(id: number, dto: UpdateDingTalkReportConfigDto) {
    await this.ensureConfig(id)
    if (dto.departmentIds?.length) {
      await this.ensureDepartments(dto.departmentIds)
    }

    const updated = await this.prisma.dingTalkReportConfig.update({
      where: { id },
      data: {
        templateType: dto.templateType,
        departmentIds: dto.departmentIds ? JSON.stringify(dto.departmentIds) : undefined,
        departmentNames: dto.departmentNames ? JSON.stringify(dto.departmentNames) : undefined,
        webhookUrl: dto.webhookUrl,
        dailyTarget: dto.dailyTarget,
        messageTemplate: dto.messageTemplate,
        isActive: dto.isActive,
      },
    })

    return this.serializeConfig(updated)
  }

  async notifyNewPerformance(payload: PerformanceNotificationPayload) {
    if (!payload.departmentId) {
      this.logger.warn(`钉钉报单跳过：缺少部门ID / ${payload.stage} / ${payload.customerName}`)
      return
    }

    const templateType = this.resolveTemplateType(payload.stage)
    const configs = await this.prisma.dingTalkReportConfig.findMany({
      where: {
        isActive: true,
        templateType,
      },
      orderBy: [{ id: 'asc' }],
    })

    const matchedConfigs = configs.filter((item) => this.parseNumberArray(item.departmentIds).includes(payload.departmentId!))
    if (!matchedConfigs.length) {
      this.logger.warn(`钉钉报单跳过：未匹配到配置 / ${payload.stage} / 部门${payload.departmentId} / ${payload.customerName}`)
      return
    }

    this.logger.log(`钉钉报单开始发送：${payload.stage} / 部门${payload.departmentId} / ${payload.customerName} / 命中${matchedConfigs.length}条配置`)

    const contentByConfig = matchedConfigs.map((config) => ({
      configId: config.id,
      webhookUrl: config.webhookUrl,
      content: this.renderTemplate(config.messageTemplate, payload, {
        dailyTarget: config.dailyTarget,
      }),
    }))

    await Promise.all(
      contentByConfig.map(async (config) => {
        if (!config.webhookUrl.trim()) {
          this.logger.warn(`钉钉报单跳过：配置${config.configId} 未填写 webhook`)
          return
        }

        try {
          const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              msgtype: 'text',
              text: {
                content: config.content,
              },
            }),
          })

          const responseText = await response.text()
          if (!response.ok) {
            this.logger.error(`钉钉报单发送失败：配置${config.configId} / HTTP ${response.status} ${response.statusText} / 响应: ${responseText}`)
            return
          }

          this.logger.log(`钉钉报单发送完成：配置${config.configId} / 响应: ${responseText}`)
        } catch (error) {
          this.logger.error(`钉钉报单发送异常: ${payload.stage} / ${payload.customerName}`, error instanceof Error ? error.stack : String(error))
        }
      }),
    )
  }

  async buildFirstSalesNotificationPayload(orderId: number) {
    const order = await this.prisma.firstSalesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        salesUser: {
          include: {
            departmentInfo: {
              include: {
                parent: {
                  include: {
                    parent: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!order) {
      return null
    }

    const dayRange = this.getDayRange(order.orderDate)
    const [dailyOrderCount, dailyAggregate] = await Promise.all([
      this.prisma.firstSalesOrder.count({
        where: {
          salesUserId: order.salesUserId,
          orderDate: {
            gte: dayRange.start,
            lt: dayRange.end,
          },
        },
      }),
      this.prisma.firstSalesOrder.aggregate({
        where: {
          salesUserId: order.salesUserId,
          orderDate: {
            gte: dayRange.start,
            lt: dayRange.end,
          },
        },
        _sum: {
          paymentAmount: true,
        },
      }),
    ])

    return {
      stage: '一销业绩' as const,
      customerName: order.customer.name,
      phone: order.customer.phone,
      maskedPhone: this.maskPhone(order.customer.phone),
      salesName: order.salesUser.realName,
      departmentId: order.salesUser.departmentId,
      departmentName: order.salesUser.departmentInfo?.name,
      groupName: order.salesUser.departmentInfo?.name,
      teamName: order.salesUser.departmentInfo?.parent?.name,
      branchName: order.salesUser.departmentInfo?.parent?.parent?.name,
      paymentAmount: Number(order.paymentAmount),
      performanceAmount: Number(order.paymentAmount),
      orderTime: order.orderDate,
      orderType: this.mapFirstSalesOrderType(order.orderType),
      isTimelyDeal: order.isTimelyDeal ? '是' : '否',
      dailyOrderCount,
      dailyPaymentAmount: Number(dailyAggregate._sum.paymentAmount || 0),
    }
  }

  async buildSecondSalesNotificationPayload(orderId: number) {
    const order = await this.prisma.secondSalesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        secondSalesUser: {
          include: {
            departmentInfo: {
              include: {
                parent: {
                  include: {
                    parent: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!order) {
      return null
    }

    const departmentSummary = await this.buildSecondSalesDepartmentSummary(order.secondSalesUser.departmentId, order.orderDate)

    return {
      stage: '二销业绩' as const,
      customerName: order.customer.name,
      phone: order.customer.phone,
      salesName: order.secondSalesUser.realName,
      departmentId: order.secondSalesUser.departmentId,
      departmentName: order.secondSalesUser.departmentInfo?.name,
      groupName: order.secondSalesUser.departmentInfo?.name,
      teamName: order.secondSalesUser.departmentInfo?.parent?.name,
      branchName: order.secondSalesUser.departmentInfo?.parent?.parent?.name,
      paymentAmount: Number(order.secondPaymentAmount),
      performanceAmount: Number(order.performanceAmount),
      orderTime: order.orderDate,
      departmentDailyPerformanceLines: departmentSummary.lines,
      departmentDailyPerformanceTotal: departmentSummary.total,
    }
  }

  async buildThirdSalesNotificationPayload(orderId: number) {
    const order = await this.prisma.thirdSalesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        thirdSalesUser: {
          include: {
            departmentInfo: {
              include: {
                parent: {
                  include: {
                    parent: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!order) {
      return null
    }

    return {
      stage: '三销业绩' as const,
      customerName: order.customer.name,
      phone: order.customer.phone,
      salesName: order.thirdSalesUser.realName,
      departmentId: order.thirdSalesUser.departmentId,
      departmentName: order.thirdSalesUser.departmentInfo?.name,
      groupName: order.thirdSalesUser.departmentInfo?.name,
      teamName: order.thirdSalesUser.departmentInfo?.parent?.name,
      branchName: order.thirdSalesUser.departmentInfo?.parent?.parent?.name,
      paymentAmount: Number(order.paymentAmount),
      performanceAmount: Number(order.performanceAmount),
      orderTime: order.orderDate,
    }
  }

  private renderTemplate(template: string, payload: PerformanceNotificationPayload, configValues?: { dailyTarget?: string | null }) {
    const values: Record<string, string> = {
      stage: payload.stage,
      customerName: payload.customerName,
      phone: payload.phone,
      maskedPhone: payload.maskedPhone || this.maskPhone(payload.phone),
      salesName: payload.salesName,
      departmentName: payload.departmentName || '-',
      groupName: payload.groupName || payload.departmentName || '-',
      teamName: payload.teamName || '-',
      branchName: payload.branchName || '-',
      paymentAmount: String(payload.paymentAmount),
      performanceAmount: String(payload.performanceAmount),
      orderTime: this.formatDateTime(payload.orderTime),
      orderType: payload.orderType || '-',
      isTimelyDeal: payload.isTimelyDeal || '-',
      dailyOrderCount: String(payload.dailyOrderCount ?? 0),
      dailyPaymentAmount: String(payload.dailyPaymentAmount ?? 0),
      departmentDailyPerformanceLines: payload.departmentDailyPerformanceLines || '-',
      departmentDailyPerformanceTotal: String(payload.departmentDailyPerformanceTotal ?? 0),
      dailyTarget: configValues?.dailyTarget?.trim() || '-',
    }

    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] || '')
  }

  private resolveTemplateType(stage: PerformanceStage): DingTalkReportTemplateType {
    return stage === '一销业绩' ? 'FIRST_SALES' : 'LITIGATION'
  }

  private serializeConfig(item: {
    id: number
    templateType: string
    departmentIds: string
    departmentNames: string
    webhookUrl: string
    dailyTarget: string | null
    messageTemplate: string
    isActive: boolean
    updatedAt: Date
    createdAt: Date
  }) {
    return {
      id: item.id,
      templateType: this.normalizeTemplateType(item.templateType),
      departmentIds: this.parseNumberArray(item.departmentIds),
      departmentNames: this.parseStringArray(item.departmentNames),
      webhookUrl: item.webhookUrl,
      dailyTarget: item.dailyTarget || undefined,
      messageTemplate: item.messageTemplate,
      isActive: item.isActive,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
    }
  }

  private normalizeTemplateType(value: string): DingTalkReportTemplateType {
    return value === 'LITIGATION' ? 'LITIGATION' : 'FIRST_SALES'
  }

  private maskPhone(phone: string) {
    return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
  }

  private mapFirstSalesOrderType(orderType: string) {
    const labels: Record<string, string> = {
      DEPOSIT: '定金',
      TAIL: '尾款',
      FULL: '全款',
    }

    return labels[orderType] || orderType
  }

  private getDayRange(date: Date) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    return { start, end }
  }

  private async buildSecondSalesDepartmentSummary(departmentId: number | null | undefined, orderDate: Date) {
    if (!departmentId) {
      return {
        lines: '-',
        total: 0,
      }
    }

    const members = await this.prisma.user.findMany({
      where: { departmentId },
      select: {
        id: true,
        realName: true,
      },
      orderBy: { id: 'asc' },
    })

    if (!members.length) {
      return {
        lines: '-',
        total: 0,
      }
    }

    const dayRange = this.getDayRange(orderDate)
    const orders = await this.prisma.secondSalesOrder.findMany({
      where: {
        secondSalesUserId: {
          in: members.map((item) => item.id),
        },
        orderDate: {
          gte: dayRange.start,
          lt: dayRange.end,
        },
      },
      select: {
        secondSalesUserId: true,
        performanceAmount: true,
      },
    })

    const amountMap = new Map<number, number>()
    for (const item of orders) {
      amountMap.set(item.secondSalesUserId, (amountMap.get(item.secondSalesUserId) || 0) + Number(item.performanceAmount))
    }

    const rows = members
      .map((member) => ({
        name: member.realName,
        amount: Number((amountMap.get(member.id) || 0).toFixed(2)),
      }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'zh-CN'))

    return {
      lines: rows.map((item) => `${item.name}：${this.formatAmount(item.amount)}`).join('\n'),
      total: Number(rows.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
    }
  }

  private formatAmount(amount: number) {
    return Number.isInteger(amount) ? String(amount) : String(amount)
  }

  private formatDateTime(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  private async ensureDepartments(ids: number[]) {
    const count = await this.prisma.department.count({
      where: {
        id: {
          in: ids,
        },
      },
    })

    if (count !== ids.length) {
      throw new NotFoundException('部门不存在')
    }
  }

  private async ensureConfig(id: number) {
    const config = await this.prisma.dingTalkReportConfig.findUnique({ where: { id } })
    if (!config) {
      throw new NotFoundException('钉钉报单配置不存在')
    }
    return config
  }

  private parseNumberArray(value: string) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item)) : []
    } catch {
      return []
    }
  }

  private parseStringArray(value: string) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  }
}
