import { ForbiddenException, Injectable } from '@nestjs/common'
import { DataScope, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { DepartmentsService } from '../departments/departments.service'
import { SaveTrafficStatDto } from './dto/save-traffic-stat.dto'
import { TrafficStatsQueryDto } from './dto/traffic-stats-query.dto'

type TrafficStatUserContext = {
  id?: number | null
  realName?: string | null
  department?: string | null
  departmentId?: number | null
  departmentInfo?: {
    name?: string | null
    parent?: {
      name?: string | null
    } | null
  } | null
} | null

type TrafficStatManualRow = {
  id: number
  reportDate: Date
  userId: number
  departmentId: number | null
  firstSalesTeamName: string | null
  firstSalesDepartmentName: string | null
  transferCount: number
  addCount: number
  depositCount: number
  tailCount: number
  fullCount: number
  timelyCount: number
  totalPerformance: Prisma.Decimal
  createdAt: Date
  updatedAt: Date
  user?: TrafficStatUserContext
  department?: {
    name?: string | null
  } | null
}

type TrafficStatCrmStats = {
  depositCount: number
  tailCount: number
  fullCount: number
  timelyCount: number
  totalPerformance: number
}

type TrafficStatSummaryRow = {
  date: string
  transferCount: number
  addCount: number
  depositCount: number
  tailCount: number
  fullCount: number
  timelyCount: number
  totalPerformance: number
}

@Injectable()
export class TrafficStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async getMyDailyStat(currentUser: AuthenticatedUser, date?: string) {
    const reportDate = this.resolveReportDate(date)
    const [item, userContext, crmStatsMap] = await Promise.all([
      this.prisma.trafficStat.findUnique({
        where: {
          reportDate_userId: {
            reportDate,
            userId: currentUser.id,
          },
        },
      }),
      this.loadTrafficStatUserContext(currentUser.id),
      this.loadCrmStatsByUserDatePairs([{ userId: currentUser.id, reportDate }]),
    ])

    const crmStats = crmStatsMap.get(this.buildUserDateKey(currentUser.id, reportDate)) || this.createEmptyCrmStats()
    const stats = this.normalizeStats({
      transferCount: item?.transferCount,
      addCount: item?.addCount,
      ...crmStats,
    })
    const metrics = this.buildMetrics(stats)
    return {
      reportDate: this.toDateKey(reportDate),
      salesName: currentUser.realName,
      firstSalesTeamName: item?.firstSalesTeamName || this.resolveFirstSalesTeamName(userContext) || currentUser.department || undefined,
      firstSalesDepartmentName: item?.firstSalesDepartmentName || this.resolveFirstSalesDepartmentName(userContext) || currentUser.department || undefined,
      transferCount: stats.transferCount,
      addCount: stats.addCount,
      depositCount: stats.depositCount,
      tailCount: stats.tailCount,
      fullCount: stats.fullCount,
      timelyCount: stats.timelyCount,
      totalPerformance: stats.totalPerformance,
      depositConversionRate: metrics.depositConversionRate,
      conversionRate: metrics.conversionRate,
      lossRate: metrics.lossRate,
    }
  }

  async saveMyDailyStat(currentUser: AuthenticatedUser, dto: SaveTrafficStatDto) {
    const reportDate = this.resolveReportDate(dto.reportDate)
    const [userContext, crmStatsMap] = await Promise.all([
      this.loadTrafficStatUserContext(currentUser.id),
      this.loadCrmStatsByUserDatePairs([{ userId: currentUser.id, reportDate }]),
    ])
    const crmStats = crmStatsMap.get(this.buildUserDateKey(currentUser.id, reportDate)) || this.createEmptyCrmStats()
    const departmentId = currentUser.departmentId ?? userContext?.departmentId ?? null
    const firstSalesTeamName = this.resolveFirstSalesTeamName(userContext) || currentUser.department || undefined
    const firstSalesDepartmentName = this.resolveFirstSalesDepartmentName(userContext) || currentUser.department || undefined

    const item = await this.prisma.trafficStat.upsert({
      where: {
        reportDate_userId: {
          reportDate,
          userId: currentUser.id,
        },
      },
      create: {
        reportDate,
        userId: currentUser.id,
        departmentId,
        firstSalesTeamName,
        firstSalesDepartmentName,
        transferCount: dto.transferCount,
        addCount: dto.addCount,
        depositCount: crmStats.depositCount,
        tailCount: crmStats.tailCount,
        fullCount: crmStats.fullCount,
        timelyCount: crmStats.timelyCount,
        totalPerformance: crmStats.totalPerformance,
      },
      update: {
        departmentId,
        firstSalesTeamName,
        firstSalesDepartmentName,
        transferCount: dto.transferCount,
        addCount: dto.addCount,
        depositCount: crmStats.depositCount,
        tailCount: crmStats.tailCount,
        fullCount: crmStats.fullCount,
        timelyCount: crmStats.timelyCount,
        totalPerformance: crmStats.totalPerformance,
      },
      include: {
        user: {
          include: {
            departmentInfo: {
              include: {
                parent: true,
              },
            },
          },
        },
        department: true,
      },
    })

    return this.mapRow(item)
  }

  async findRows(currentUser: AuthenticatedUser, query: TrafficStatsQueryDto) {
    const where = await this.buildVisibilityWhere(currentUser, query.departmentId)
    const items = await this.prisma.trafficStat.findMany({
      where: {
        reportDate: this.buildDateFilter(query),
        ...where,
      },
      include: {
        user: {
          include: {
            departmentInfo: {
              include: {
                parent: true,
              },
            },
          },
        },
        department: true,
      },
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
    })

    return {
      rows: items.map((item) => this.mapRow(item)),
    }
  }

  async getSummary(currentUser: AuthenticatedUser, query: TrafficStatsQueryDto) {
    const groups = await this.prisma.trafficStat.groupBy({
      by: ['reportDate'],
      where: {
        reportDate: this.buildDateFilter(query),
        ...(await this.buildVisibilityWhere(currentUser, query.departmentId)),
      },
      _sum: {
        transferCount: true,
        addCount: true,
        depositCount: true,
        tailCount: true,
        fullCount: true,
        timelyCount: true,
        totalPerformance: true,
      },
      orderBy: { reportDate: 'desc' },
    })

    const rows = groups.map((group) => {
      const stats = this.normalizeStats(group._sum)
      const metrics = this.buildMetrics(stats)
      return {
        date: this.toDateKey(group.reportDate),
        transferCount: stats.transferCount,
        addCount: stats.addCount,
        depositCount: stats.depositCount,
        tailCount: stats.tailCount,
        fullCount: stats.fullCount,
        timelyCount: stats.timelyCount,
        totalPerformance: stats.totalPerformance,
        depositConversionRate: metrics.depositConversionRate,
        conversionRate: metrics.conversionRate,
        lossRate: metrics.lossRate,
      }
    })

    const totals = rows.reduce(
      (result, item) => {
        result.transferCount += item.transferCount
        result.addCount += item.addCount
        result.depositCount += item.depositCount
        result.tailCount += item.tailCount
        result.fullCount += item.fullCount
        result.timelyCount += item.timelyCount
        result.totalPerformance += item.totalPerformance
        return result
      },
      {
        transferCount: 0,
        addCount: 0,
        depositCount: 0,
        tailCount: 0,
        fullCount: 0,
        timelyCount: 0,
        totalPerformance: 0,
      },
    )

    return {
      totals: {
        ...totals,
        ...this.buildMetrics(totals),
      },
      rows,
    }
  }

  async getDepartmentOptions(currentUser: AuthenticatedUser) {
    const visibleDepartmentIds = await this.buildVisibleDepartmentIds(currentUser)
    const departments = await this.prisma.department.findMany({
      where: visibleDepartmentIds ? { id: { in: visibleDepartmentIds } } : undefined,
      select: {
        id: true,
        name: true,
        parentId: true,
        sort: true,
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })

    const itemMap = new Map(departments.map((item) => [item.id, item]))
    return departments.map((item) => ({
      id: item.id,
      name: this.buildDepartmentPath(item.id, itemMap),
    }))
  }

  private mapRow(item: TrafficStatManualRow) {
    const stats = this.normalizeStats(item)
    const metrics = this.buildMetrics(stats)
    return {
      id: item.id,
      reportDate: this.toDateKey(item.reportDate),
      userId: item.userId,
      userName: item.user?.realName || '',
      salesName: item.user?.realName || '',
      departmentId: item.departmentId ?? item.user?.departmentId ?? undefined,
      departmentName: item.department?.name || item.user?.departmentInfo?.name || item.user?.department || '',
      firstSalesTeamName: item.firstSalesTeamName || this.resolveFirstSalesTeamName(item.user),
      firstSalesDepartmentName: item.firstSalesDepartmentName || this.resolveFirstSalesDepartmentName(item.user),
      transferCount: stats.transferCount,
      addCount: stats.addCount,
      depositCount: stats.depositCount,
      tailCount: stats.tailCount,
      fullCount: stats.fullCount,
      timelyCount: stats.timelyCount,
      totalPerformance: stats.totalPerformance,
      depositConversionRate: metrics.depositConversionRate,
      conversionRate: metrics.conversionRate,
      lossRate: metrics.lossRate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  private normalizeStats(source?: {
    transferCount?: number | null
    addCount?: number | null
    depositCount?: number | null
    tailCount?: number | null
    fullCount?: number | null
    timelyCount?: number | null
    totalPerformance?: Prisma.Decimal | number | null
  } | null) {
    return {
      transferCount: source?.transferCount ?? 0,
      addCount: source?.addCount ?? 0,
      depositCount: source?.depositCount ?? 0,
      tailCount: source?.tailCount ?? 0,
      fullCount: source?.fullCount ?? 0,
      timelyCount: source?.timelyCount ?? 0,
      totalPerformance: Number(source?.totalPerformance ?? 0),
    }
  }

  private createEmptyCrmStats(): TrafficStatCrmStats {
    return {
      depositCount: 0,
      tailCount: 0,
      fullCount: 0,
      timelyCount: 0,
      totalPerformance: 0,
    }
  }

  private buildMetrics(source?: {
    transferCount?: number | null
    addCount?: number | null
    depositCount?: number | null
    tailCount?: number | null
    fullCount?: number | null
  } | null) {
    const transferCount = source?.transferCount ?? 0
    const addCount = source?.addCount ?? 0
    const depositCount = source?.depositCount ?? 0
    const tailCount = source?.tailCount ?? 0
    const fullCount = source?.fullCount ?? 0

    return {
      depositConversionRate: this.calculateRate(depositCount, transferCount),
      conversionRate: this.calculateRate(tailCount + fullCount, transferCount),
      lossRate: transferCount ? Number((1 - addCount / transferCount).toFixed(4)) : 0,
    }
  }

  private resolveReportDate(date?: string) {
    const value = date || new Date().toISOString().slice(0, 10)
    return new Date(value)
  }

  private buildDateFilter(query: TrafficStatsQueryDto) {
    if (!query.startDate && !query.endDate) {
      return undefined
    }

    return {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    }
  }

  private toDateKey(date: Date) {
    return date.toISOString().slice(0, 10)
  }

  private buildUserDateKey(userId: number, reportDate: Date) {
    return `${userId}-${this.toDateKey(reportDate)}`
  }

  private calculateRate(numerator: number, denominator: number) {
    if (!denominator) {
      return 0
    }
    return Number((numerator / denominator).toFixed(4))
  }

  private resolveFirstSalesTeamName(user?: TrafficStatUserContext) {
    return user?.departmentInfo?.parent?.name || user?.departmentInfo?.name || user?.department || undefined
  }

  private resolveFirstSalesDepartmentName(user?: TrafficStatUserContext) {
    return user?.departmentInfo?.name || user?.department || undefined
  }

  private async loadTrafficStatUserContext(userId: number): Promise<TrafficStatUserContext> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        realName: true,
        department: true,
        departmentId: true,
        departmentInfo: {
          select: {
            name: true,
            parent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })
  }

  private async loadCrmStatsByUserDatePairs(pairs: Array<{ userId: number; reportDate: Date }>) {
    const uniquePairs = Array.from(new Map(
      pairs.map((item) => [this.buildUserDateKey(item.userId, item.reportDate), item]),
    ).values())

    if (!uniquePairs.length) {
      return new Map<string, TrafficStatCrmStats>()
    }

    const userIds = Array.from(new Set(uniquePairs.map((item) => item.userId)))
    const dateKeys = Array.from(new Set(uniquePairs.map((item) => this.toDateKey(item.reportDate))))
    const minDateKey = dateKeys.reduce((min, value) => (value < min ? value : min), dateKeys[0])
    const maxDateKey = dateKeys.reduce((max, value) => (value > max ? value : max), dateKeys[0])
    const rangeEnd = new Date(maxDateKey)
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1)

    const groups = await this.prisma.firstSalesOrder.groupBy({
      by: ['salesUserId', 'orderDate', 'orderType', 'isTimelyDeal'],
      where: {
        salesUserId: { in: userIds },
        orderDate: {
          gte: new Date(minDateKey),
          lt: rangeEnd,
        },
      },
      _count: { _all: true },
      _sum: { paymentAmount: true },
      orderBy: [{ salesUserId: 'asc' }, { orderDate: 'asc' }],
    })

    const targetKeys = new Set(uniquePairs.map((item) => this.buildUserDateKey(item.userId, item.reportDate)))
    const map = new Map<string, TrafficStatCrmStats>()
    for (const group of groups) {
      const key = this.buildUserDateKey(group.salesUserId, group.orderDate)
      if (!targetKeys.has(key)) {
        continue
      }
      const current = map.get(key) || this.createEmptyCrmStats()
      const count = group._count._all
      const amount = Number(group._sum.paymentAmount || 0)
      if (group.isTimelyDeal) current.timelyCount += count
      if (group.orderType === 'DEPOSIT') current.depositCount += count
      if (group.orderType === 'TAIL') current.tailCount += count
      if (group.orderType === 'FULL') current.fullCount += count
      current.totalPerformance += amount
      map.set(key, current)
    }

    return map
  }

  private async buildVisibleDepartmentIds(currentUser: AuthenticatedUser): Promise<number[] | null> {
    switch (currentUser.reportScope) {
      case DataScope.ALL:
        return null
      case DataScope.SELF:
        return currentUser.departmentId ? [currentUser.departmentId] : []
      case DataScope.DEPARTMENT:
        return currentUser.departmentId ? [currentUser.departmentId] : []
      case DataScope.DEPARTMENT_AND_CHILDREN:
        if (!currentUser.departmentId) {
          return []
        }
        return this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId)
      default:
        return []
    }
  }

  private async resolveFilteredDepartmentIds(currentUser: AuthenticatedUser, departmentId?: number) {
    const visibleDepartmentIds = await this.buildVisibleDepartmentIds(currentUser)
    if (!departmentId) {
      return visibleDepartmentIds
    }

    const targetId = Number(departmentId)
    if (!Number.isFinite(targetId)) {
      throw new ForbiddenException('部门参数不合法')
    }

    const targetIds = await this.departmentsService.findDepartmentAndDescendantIds(targetId)
    if (!visibleDepartmentIds) {
      return targetIds
    }

    const allowedIds = targetIds.filter((id) => visibleDepartmentIds.includes(id))
    if (!allowedIds.length) {
      throw new ForbiddenException('无权查看该部门数据')
    }

    return allowedIds
  }

  private async buildVisibilityWhere(currentUser: AuthenticatedUser, departmentId?: number): Promise<Prisma.TrafficStatWhereInput> {
    if (currentUser.reportScope === DataScope.SELF) {
      return { userId: currentUser.id }
    }

    const filteredDepartmentIds = await this.resolveFilteredDepartmentIds(currentUser, departmentId)
    if (filteredDepartmentIds === null) {
      return {}
    }

    if (!filteredDepartmentIds.length) {
      return { id: -1 }
    }

    return {
      departmentId: {
        in: filteredDepartmentIds,
      },
    }
  }

  private buildDepartmentPath(
    departmentId: number,
    itemMap: Map<number, { id: number; name: string; parentId: number | null; sort: number }>,
  ) {
    const names: string[] = []
    let current = itemMap.get(departmentId)

    while (current) {
      names.unshift(current.name)
      current = current.parentId ? itemMap.get(current.parentId) : undefined
    }

    return names.join(' / ')
  }
}
