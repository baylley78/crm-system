import { ForbiddenException, Injectable } from '@nestjs/common'
import { DataScope, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { DepartmentsService } from '../departments/departments.service'
import { SaveTrafficStatDto } from './dto/save-traffic-stat.dto'
import { TrafficStatsQueryDto } from './dto/traffic-stats-query.dto'

@Injectable()
export class TrafficStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async getMyDailyStat(currentUser: AuthenticatedUser, date?: string) {
    const reportDate = this.resolveReportDate(date)
    const item = await this.prisma.trafficStat.findUnique({
      where: {
        reportDate_userId: {
          reportDate,
          userId: currentUser.id,
        },
      },
    })

    return {
      reportDate: this.toDateKey(reportDate),
      transferCount: item?.transferCount ?? 0,
      receptionCount: item?.receptionCount ?? 0,
      conversionRate: this.calculateConversionRate(item?.transferCount ?? 0, item?.receptionCount ?? 0),
    }
  }

  async saveMyDailyStat(currentUser: AuthenticatedUser, dto: SaveTrafficStatDto) {
    const reportDate = this.resolveReportDate(dto.reportDate)
    const departmentId = currentUser.departmentId ?? null

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
        transferCount: dto.transferCount,
        receptionCount: dto.receptionCount,
      },
      update: {
        departmentId,
        transferCount: dto.transferCount,
        receptionCount: dto.receptionCount,
      },
      include: {
        user: {
          include: {
            departmentInfo: true,
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
            departmentInfo: true,
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
        receptionCount: true,
      },
      orderBy: { reportDate: 'desc' },
    })

    const rows = groups.map((group) => {
      const transferCount = group._sum.transferCount ?? 0
      const receptionCount = group._sum.receptionCount ?? 0
      return {
        date: this.toDateKey(group.reportDate),
        transferCount,
        receptionCount,
        conversionRate: this.calculateConversionRate(transferCount, receptionCount),
      }
    })

    const totals = rows.reduce(
      (result, item) => {
        result.transferCount += item.transferCount
        result.receptionCount += item.receptionCount
        return result
      },
      { transferCount: 0, receptionCount: 0 },
    )

    return {
      totals: {
        ...totals,
        conversionRate: this.calculateConversionRate(totals.transferCount, totals.receptionCount),
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
    const departmentName = item.department?.name || item.user?.departmentInfo?.name || item.user?.department || ''
    return {
      id: item.id,
      reportDate: this.toDateKey(item.reportDate),
      userId: item.userId,
      userName: item.user?.realName || '',
      departmentId: item.departmentId ?? item.user?.departmentId ?? undefined,
      departmentName,
      transferCount: item.transferCount,
      receptionCount: item.receptionCount,
      conversionRate: this.calculateConversionRate(item.transferCount, item.receptionCount),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
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

  private calculateConversionRate(transferCount: number, receptionCount: number) {
    if (!transferCount) {
      return 0
    }
    return Number((receptionCount / transferCount).toFixed(4))
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
