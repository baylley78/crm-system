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

@Injectable()
export class TrafficStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async getMyDailyStat(currentUser: AuthenticatedUser, date?: string) {
    const reportDate = this.resolveReportDate(date)
    const [item, userContext] = await Promise.all([
      this.prisma.trafficStat.findUnique({
        where: {
          reportDate_userId: {
            reportDate,
            userId: currentUser.id,
          },
        },
      }),
      this.loadTrafficStatUserContext(currentUser.id),
    ])

    const metrics = this.buildMetrics(item)
    return {
      reportDate: this.toDateKey(reportDate),
      salesName: currentUser.realName,
      firstSalesTeamName: item?.firstSalesTeamName || this.resolveFirstSalesTeamName(userContext) || currentUser.department || undefined,
      firstSalesDepartmentName: item?.firstSalesDepartmentName || this.resolveFirstSalesDepartmentName(userContext) || currentUser.department || undefined,
      transferCount: item?.transferCount ?? 0,
      addCount: item?.addCount ?? 0,
      depositCount: item?.depositCount ?? 0,
      tailCount: item?.tailCount ?? 0,
      fullCount: item?.fullCount ?? 0,
      timelyCount: item?.timelyCount ?? 0,
      totalPerformance: Number(item?.totalPerformance ?? 0),
      depositConversionRate: metrics.depositConversionRate,
      conversionRate: metrics.conversionRate,
      lossRate: metrics.lossRate,
    }
  }

  async saveMyDailyStat(currentUser: AuthenticatedUser, dto: SaveTrafficStatDto) {
    const reportDate = this.resolveReportDate(dto.reportDate)
    const userContext = await this.loadTrafficStatUserContext(currentUser.id)
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
        depositCount: dto.depositCount,
        tailCount: dto.tailCount,
        fullCount: dto.fullCount,
        timelyCount: dto.timelyCount,
        totalPerformance: dto.totalPerformance,
      },
      update: {
        departmentId,
        firstSalesTeamName,
        firstSalesDepartmentName,
        transferCount: dto.transferCount,
        addCount: dto.addCount,
        depositCount: dto.depositCount,
        tailCount: dto.tailCount,
        fullCount: dto.fullCount,
        timelyCount: dto.timelyCount,
        totalPerformance: dto.totalPerformance,
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
    const where = await this.buildVisibilityWhere(currentUser, query.departmentId)
    const groups = await this.prisma.trafficStat.groupBy({
      by: ['reportDate'],
      where: {
        reportDate: this.buildDateFilter(query),
        ...where,
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
      const stats = this.normalizeStats({
        transferCount: group._sum.transferCount,
        addCount: group._sum.addCount,
        depositCount: group._sum.depositCount,
        tailCount: group._sum.tailCount,
        fullCount: group._sum.fullCount,
        timelyCount: group._sum.timelyCount,
        totalPerformance: group._sum.totalPerformance,
      })
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

  private mapRow(item: any) {
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

  private buildMetrics(source?: {
    addCount?: number | null
    depositCount?: number | null
    tailCount?: number | null
    fullCount?: number | null
  } | null) {
    const addCount = source?.addCount ?? 0
    const depositCount = source?.depositCount ?? 0
    const tailCount = source?.tailCount ?? 0
    const fullCount = source?.fullCount ?? 0
    const convertedCount = depositCount + tailCount + fullCount
    const lostCount = Math.max(addCount - convertedCount, 0)

    return {
      depositConversionRate: this.calculateRate(depositCount, addCount),
      conversionRate: this.calculateRate(convertedCount, addCount),
      lossRate: this.calculateRate(lostCount, addCount),
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
