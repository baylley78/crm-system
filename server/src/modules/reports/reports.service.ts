import { Injectable } from '@nestjs/common'
import { DataScope } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import type { AuthenticatedUser } from '../auth/auth.service'

type ReportStage = 'first-sales' | 'second-sales' | 'third-sales'

const REPORT_STAGE_TEAM_ROOTS: Record<ReportStage, string[]> = {
  'first-sales': ['一销团队'],
  'second-sales': ['二销团队'],
  'third-sales': ['二销团队', '三销团队'],
}

interface ReportQuery {
  startDate?: string
  endDate?: string
  departmentId?: string
}

interface ReportDetailsQuery extends ReportQuery {
  export?: string
  page?: number
  pageSize?: number
}

export interface PaginatedReportDetailRows {
  items: ReportDetailRow[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 30

export interface ReportDepartmentOption {
  id: number
  name: string
}

export interface ReportSummaryCard {
  title: string
  value: number
}

export interface ReportDetailRow {
  id: number
  customerName: string
  phone: string
  operatorName: string
  departmentName: string
  paymentAmount: number
  performanceAmount: number
  extraLabel: string
  status: string
  orderDate: Date
}

export interface FirstSalesPersonalRow {
  userName: string
  timelyCount: number
  depositCount: number
  tailCount: number
  fullCount: number
  depositAmount: number
  tailAmount: number
  fullAmount: number
  totalAmount: number
  avgAmount: number
}

export interface FirstSalesTeamRow {
  date: string
  timelyCount: number
  depositCount: number
  tailCount: number
  fullCount: number
  depositAmount: number
  tailAmount: number
  fullAmount: number
  totalAmount: number
  avgAmount: number
}

export interface SecondSalesPersonalRow {
  userName: string
  receptionCount: number
  targetAmount: number
  dealCount: number
  dealAmount: number
  conversionRate: number
  avgAmount: number
  unitQ: number
}

export interface SecondSalesTeamRow {
  date: string
  receptionCount: number
  targetAmount: number
  dealCount: number
  dealAmount: number
  conversionRate: number
  avgAmount: number
  unitQ: number
}

export interface ThirdSalesPersonalRow {
  userName: string
  dealAmount: number
}

export interface ThirdSalesTeamRow {
  date: string
  dealAmount: number
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async getSummary(currentUser: AuthenticatedUser, query: ReportQuery) {
    const firstSalesWhere = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildFirstSalesVisibilityWhere(currentUser, query.departmentId)),
    }
    const secondSalesWhere = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildSecondSalesVisibilityWhere(currentUser, query.departmentId)),
    }
    const thirdSalesWhere = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildThirdSalesVisibilityWhere(currentUser, query.departmentId)),
    }

    const [firstSales, secondSales, thirdSales] = await Promise.all([
      this.prisma.firstSalesOrder.aggregate({
        where: firstSalesWhere,
        _sum: { paymentAmount: true },
      }),
      this.prisma.secondSalesOrder.aggregate({
        where: secondSalesWhere,
        _sum: { performanceAmount: true },
      }),
      this.prisma.thirdSalesOrder.aggregate({
        where: thirdSalesWhere,
        _sum: { performanceAmount: true },
      }),
    ])

    const firstSalesTotal = Number(firstSales._sum.paymentAmount || 0)
    const secondSalesTotal = Number(secondSales._sum.performanceAmount || 0)
    const thirdSalesTotal = Number(thirdSales._sum.performanceAmount || 0)

    return {
      cards: [
        { title: '一销总金额', value: firstSalesTotal },
        { title: '二销成交金额', value: secondSalesTotal },
        { title: '三销成交金额', value: thirdSalesTotal },
        {
          title: '总成交金额',
          value: firstSalesTotal + secondSalesTotal + thirdSalesTotal,
        },
      ],
    }
  }

  async getDepartmentOptions(currentUser: AuthenticatedUser, stage: ReportStage): Promise<{ options: ReportDepartmentOption[] }> {
    const visibleDepartmentIds = await this.buildVisibleDepartmentIds(currentUser)
    const departmentTree = await this.departmentsService.findTree(currentUser)
    const stageDepartmentIds = this.collectStageDepartmentIds(departmentTree, REPORT_STAGE_TEAM_ROOTS[stage])
    const allowedDepartmentIds = visibleDepartmentIds
      ? stageDepartmentIds.filter((id) => visibleDepartmentIds.includes(id))
      : stageDepartmentIds

    if (!allowedDepartmentIds.length) {
      return { options: [] }
    }

    const options = this.flattenDepartmentOptions(departmentTree)
      .filter((item) => allowedDepartmentIds.includes(item.id))

    return { options }
  }

  async getFirstSalesPersonal(currentUser: AuthenticatedUser, query: ReportQuery): Promise<{ rows: FirstSalesPersonalRow[] }> {
    const where = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildFirstSalesVisibilityWhere(currentUser, query.departmentId)),
    }
    const groups = await this.prisma.firstSalesOrder.groupBy({
      by: ['salesUserId', 'orderType', 'isTimelyDeal'],
      where,
      _count: { _all: true },
      _sum: { paymentAmount: true },
      orderBy: { salesUserId: 'asc' },
    })

    const salesUserIds = Array.from(new Set(groups.map((item) => item.salesUserId)))
    const users = salesUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: salesUserIds } },
          select: { id: true, realName: true },
        })
      : []
    const userNameMap = new Map(users.map((user) => [user.id, user.realName]))

    const map = new Map<number, FirstSalesPersonalRow>()
    for (const group of groups) {
      const current = map.get(group.salesUserId) || {
        userName: userNameMap.get(group.salesUserId) || '',
        timelyCount: 0,
        depositCount: 0,
        tailCount: 0,
        fullCount: 0,
        depositAmount: 0,
        tailAmount: 0,
        fullAmount: 0,
        totalAmount: 0,
        avgAmount: 0,
      }
      const count = group._count._all
      const amount = Number(group._sum.paymentAmount || 0)
      if (group.isTimelyDeal) current.timelyCount += count
      if (group.orderType === 'DEPOSIT') {
        current.depositCount += count
        current.depositAmount += amount
      }
      if (group.orderType === 'TAIL') {
        current.tailCount += count
        current.tailAmount += amount
      }
      if (group.orderType === 'FULL') {
        current.fullCount += count
        current.fullAmount += amount
      }
      current.totalAmount += amount
      const totalCount = current.depositCount + current.tailCount + current.fullCount
      current.avgAmount = totalCount ? Number((current.totalAmount / totalCount).toFixed(2)) : 0
      map.set(group.salesUserId, current)
    }

    return { rows: Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount) }
  }

  async getFirstSalesTeam(currentUser: AuthenticatedUser, query: ReportQuery): Promise<{ rows: FirstSalesTeamRow[] }> {
    const where = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildFirstSalesVisibilityWhere(currentUser, query.departmentId)),
    }
    const groups = await this.prisma.firstSalesOrder.groupBy({
      by: ['orderDate', 'orderType', 'isTimelyDeal'],
      where,
      _count: { _all: true },
      _sum: { paymentAmount: true },
      orderBy: { orderDate: 'desc' },
    })

    const map = new Map<string, FirstSalesTeamRow>()
    for (const group of groups) {
      const key = this.toDateKey(group.orderDate)
      const current = map.get(key) || {
        date: key,
        timelyCount: 0,
        depositCount: 0,
        tailCount: 0,
        fullCount: 0,
        depositAmount: 0,
        tailAmount: 0,
        fullAmount: 0,
        totalAmount: 0,
        avgAmount: 0,
      }
      const count = group._count._all
      const amount = Number(group._sum.paymentAmount || 0)
      if (group.isTimelyDeal) current.timelyCount += count
      if (group.orderType === 'DEPOSIT') {
        current.depositCount += count
        current.depositAmount += amount
      }
      if (group.orderType === 'TAIL') {
        current.tailCount += count
        current.tailAmount += amount
      }
      if (group.orderType === 'FULL') {
        current.fullCount += count
        current.fullAmount += amount
      }
      current.totalAmount += amount
      const totalCount = current.depositCount + current.tailCount + current.fullCount
      current.avgAmount = totalCount ? Number((current.totalAmount / totalCount).toFixed(2)) : 0
      map.set(key, current)
    }

    return { rows: Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)) }
  }

  async getSecondSalesPersonal(currentUser: AuthenticatedUser, query: ReportQuery): Promise<{ rows: SecondSalesPersonalRow[] }> {
    const assignmentWhere = {
      assignedAt: this.buildDateFilter(query),
      ...(await this.buildSecondSalesAssignmentVisibilityWhere(currentUser, query.departmentId)),
    }
    const orderWhere = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildSecondSalesVisibilityWhere(currentUser, query.departmentId)),
    }

    const [assignments, orderGroups, distinctDeals] = await Promise.all([
      this.prisma.secondSalesAssignment.findMany({
        where: assignmentWhere,
        select: {
          secondSalesUserId: true,
          customer: {
            select: {
              targetAmount: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.secondSalesOrder.groupBy({
        by: ['secondSalesUserId'],
        where: orderWhere,
        _sum: { performanceAmount: true },
        orderBy: { secondSalesUserId: 'asc' },
      }),
      this.prisma.secondSalesOrder.findMany({
        where: orderWhere,
        select: { secondSalesUserId: true, customerId: true },
        distinct: ['secondSalesUserId', 'customerId'],
      }),
    ])

    const userIds = Array.from(new Set([...assignments.map((item) => item.secondSalesUserId), ...orderGroups.map((item) => item.secondSalesUserId)]))
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, realName: true },
        })
      : []
    const userNameMap = new Map(users.map((user) => [user.id, user.realName]))
    const dealCountMap = new Map<number, number>()
    for (const item of distinctDeals) {
      dealCountMap.set(item.secondSalesUserId, (dealCountMap.get(item.secondSalesUserId) || 0) + 1)
    }

    const map = new Map<number, SecondSalesPersonalRow>()
    for (const assignment of assignments) {
      const current = map.get(assignment.secondSalesUserId) || {
        userName: userNameMap.get(assignment.secondSalesUserId) || '',
        receptionCount: 0,
        targetAmount: 0,
        dealCount: 0,
        dealAmount: 0,
        conversionRate: 0,
        avgAmount: 0,
        unitQ: 0,
      }
      current.receptionCount += 1
      current.targetAmount += Number(assignment.customer.targetAmount || 0)
      map.set(assignment.secondSalesUserId, current)
    }

    for (const group of orderGroups) {
      const current = map.get(group.secondSalesUserId) || {
        userName: userNameMap.get(group.secondSalesUserId) || '',
        receptionCount: 0,
        targetAmount: 0,
        dealCount: 0,
        dealAmount: 0,
        conversionRate: 0,
        avgAmount: 0,
        unitQ: 0,
      }
      current.dealAmount = Number(group._sum.performanceAmount || 0)
      current.dealCount = dealCountMap.get(group.secondSalesUserId) || 0
      current.conversionRate = current.receptionCount ? Number((current.dealCount / current.receptionCount).toFixed(4)) : 0
      current.avgAmount = current.dealCount ? Number((current.dealAmount / current.dealCount).toFixed(2)) : 0
      current.unitQ = current.receptionCount ? Number((current.dealAmount / current.receptionCount).toFixed(2)) : 0
      map.set(group.secondSalesUserId, current)
    }

    for (const current of map.values()) {
      current.conversionRate = current.receptionCount ? Number((current.dealCount / current.receptionCount).toFixed(4)) : 0
      current.avgAmount = current.dealCount ? Number((current.dealAmount / current.dealCount).toFixed(2)) : 0
      current.unitQ = current.receptionCount ? Number((current.dealAmount / current.receptionCount).toFixed(2)) : 0
    }

    return { rows: Array.from(map.values()).sort((a, b) => b.dealAmount - a.dealAmount) }
  }

  async getSecondSalesTeam(currentUser: AuthenticatedUser, query: ReportQuery): Promise<{ rows: SecondSalesTeamRow[] }> {
    const assignmentWhere = {
      assignedAt: this.buildDateFilter(query),
      ...(await this.buildSecondSalesAssignmentVisibilityWhere(currentUser, query.departmentId)),
    }
    const orderWhere = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildSecondSalesVisibilityWhere(currentUser, query.departmentId)),
    }

    const [assignments, orders, distinctDeals] = await Promise.all([
      this.prisma.secondSalesAssignment.findMany({
        where: assignmentWhere,
        select: {
          assignedAt: true,
          customer: {
            select: {
              targetAmount: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.secondSalesOrder.findMany({
        where: orderWhere,
        select: { orderDate: true, performanceAmount: true },
        orderBy: { orderDate: 'desc' },
      }),
      this.prisma.secondSalesOrder.findMany({
        where: orderWhere,
        select: { orderDate: true, customerId: true },
      }),
    ])

    const map = new Map<string, SecondSalesTeamRow>()
    for (const assignment of assignments) {
      const key = this.toDateKey(assignment.assignedAt)
      const current = map.get(key) || {
        date: key,
        receptionCount: 0,
        targetAmount: 0,
        dealCount: 0,
        dealAmount: 0,
        conversionRate: 0,
        avgAmount: 0,
        unitQ: 0,
      }
      current.receptionCount += 1
      current.targetAmount += Number(assignment.customer.targetAmount || 0)
      map.set(key, current)
    }

    for (const order of orders) {
      const key = this.toDateKey(order.orderDate)
      const current = map.get(key) || {
        date: key,
        receptionCount: 0,
        targetAmount: 0,
        dealCount: 0,
        dealAmount: 0,
        conversionRate: 0,
        avgAmount: 0,
        unitQ: 0,
      }
      current.dealAmount += Number(order.performanceAmount)
      map.set(key, current)
    }

    const dealDateCustomerSet = new Set<string>()
    for (const item of distinctDeals) {
      const key = `${this.toDateKey(item.orderDate)}:${item.customerId}`
      if (dealDateCustomerSet.has(key)) {
        continue
      }
      dealDateCustomerSet.add(key)
      const dateKey = this.toDateKey(item.orderDate)
      const current = map.get(dateKey) || {
        date: dateKey,
        receptionCount: 0,
        targetAmount: 0,
        dealCount: 0,
        dealAmount: 0,
        conversionRate: 0,
        avgAmount: 0,
        unitQ: 0,
      }
      current.dealCount += 1
      map.set(dateKey, current)
    }

    for (const current of map.values()) {
      current.conversionRate = current.receptionCount ? Number((current.dealCount / current.receptionCount).toFixed(4)) : 0
      current.avgAmount = current.dealCount ? Number((current.dealAmount / current.dealCount).toFixed(2)) : 0
      current.unitQ = current.receptionCount ? Number((current.dealAmount / current.receptionCount).toFixed(2)) : 0
    }

    return { rows: Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)) }
  }

  async getThirdSalesPersonal(currentUser: AuthenticatedUser, query: ReportQuery): Promise<{ rows: ThirdSalesPersonalRow[] }> {
    const where = {
      orderDate: this.buildDateFilter(query),
      ...(await this.buildThirdSalesVisibilityWhere(currentUser, query.departmentId)),
    }
    const groups = await this.prisma.thirdSalesOrder.groupBy({
      by: ['thirdSalesUserId'],
      where,
      _sum: { performanceAmount: true },
      orderBy: { _sum: { performanceAmount: 'desc' } },
    })

    const userIds = groups.map((item) => item.thirdSalesUserId)
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, realName: true },
        })
      : []
    const userNameMap = new Map(users.map((user) => [user.id, user.realName]))

    return {
      rows: groups.map((group) => ({
        userName: userNameMap.get(group.thirdSalesUserId) || '',
        dealAmount: Number(group._sum.performanceAmount || 0),
      })),
    }
  }

  async getThirdSalesTeam(currentUser: AuthenticatedUser, query: ReportQuery): Promise<{ rows: ThirdSalesTeamRow[] }> {
    const groups = await this.prisma.thirdSalesOrder.groupBy({
      by: ['orderDate'],
      where: {
        orderDate: this.buildDateFilter(query),
        ...(await this.buildThirdSalesVisibilityWhere(currentUser, query.departmentId)),
      },
      _sum: { performanceAmount: true },
      orderBy: { orderDate: 'desc' },
    })

    return {
      rows: groups.map((group) => ({
        date: this.toDateKey(group.orderDate),
        dealAmount: Number(group._sum.performanceAmount || 0),
      })),
    }
  }

  private buildDateFilter(query: ReportQuery) {
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

  private flattenDepartmentOptions(
    items: Array<{ id: number; name: string; children?: any[] }>,
    prefix = '',
  ): ReportDepartmentOption[] {
    return items.flatMap((item) => {
      const label = prefix ? `${prefix} / ${item.name}` : item.name
      return [{ id: item.id, name: label }, ...this.flattenDepartmentOptions(item.children || [], label)]
    })
  }

  private collectStageDepartmentIds(items: Array<{ id: number; name: string; children?: any[] }>, rootNames: string[]) {
    const seen = new Set<number>()
    const result: number[] = []

    for (const rootName of rootNames) {
      const nodes = this.findDepartmentNodesByName(items, rootName)
      this.collectDepartmentIds(nodes, seen, result)
    }

    return result
  }

  private findDepartmentNodesByName(items: Array<{ id: number; name: string; children?: any[] }>, name: string): Array<{ id: number; name: string; children?: any[] }> {
    const normalizedTarget = name.replace(/\s+/g, '')
    const matched: Array<{ id: number; name: string; children?: any[] }> = []

    for (const item of items) {
      if (item.name.replace(/\s+/g, '') === normalizedTarget) {
        matched.push(item)
      }
      matched.push(...this.findDepartmentNodesByName(item.children || [], name))
    }

    return matched
  }

  private collectDepartmentIds(items: Array<{ id: number; children?: any[] }>, seen: Set<number>, result: number[]) {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        result.push(item.id)
      }
      this.collectDepartmentIds(item.children || [], seen, result)
    }
  }

  private async buildVisibleDepartmentIds(currentUser: AuthenticatedUser): Promise<number[] | null> {
    if (!currentUser.departmentId) {
      return null
    }

    if (currentUser.reportScope === DataScope.DEPARTMENT_AND_CHILDREN) {
      return this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId)
    }

    return [currentUser.departmentId]
  }

  private async resolveFilteredDepartmentIds(currentUser: AuthenticatedUser, departmentId?: string) {
    const visibleDepartmentIds = await this.buildVisibleDepartmentIds(currentUser)
    if (!departmentId) {
      return visibleDepartmentIds
    }

    const targetId = Number(departmentId)
    if (!Number.isFinite(targetId)) {
      return []
    }

    if (!visibleDepartmentIds) {
      return [targetId]
    }

    return visibleDepartmentIds.includes(targetId) ? [targetId] : []
  }

  private async buildFirstSalesVisibilityWhere(currentUser: AuthenticatedUser, departmentId?: string): Promise<Prisma.FirstSalesOrderWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL: {
        const filteredDepartmentIds = departmentId ? [Number(departmentId)].filter(Number.isFinite) : null
        return filteredDepartmentIds?.length ? { salesUser: { departmentId: { in: filteredDepartmentIds } } } : {}
      }
      case DataScope.SELF:
        return { salesUserId: currentUser.id }
      case DataScope.DEPARTMENT:
      case DataScope.DEPARTMENT_AND_CHILDREN: {
        const departmentIds = await this.resolveFilteredDepartmentIds(currentUser, departmentId)
        return departmentIds ? { salesUser: { departmentId: { in: departmentIds } } } : { id: -1 }
      }
      default:
        return { id: -1 }
    }
  }

  private async buildSecondSalesVisibilityWhere(currentUser: AuthenticatedUser, departmentId?: string): Promise<Prisma.SecondSalesOrderWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL: {
        const filteredDepartmentIds = departmentId ? [Number(departmentId)].filter(Number.isFinite) : null
        return filteredDepartmentIds?.length ? { secondSalesUser: { departmentId: { in: filteredDepartmentIds } } } : {}
      }
      case DataScope.SELF:
        return { secondSalesUserId: currentUser.id }
      case DataScope.DEPARTMENT:
      case DataScope.DEPARTMENT_AND_CHILDREN: {
        const departmentIds = await this.resolveFilteredDepartmentIds(currentUser, departmentId)
        return departmentIds ? { secondSalesUser: { departmentId: { in: departmentIds } } } : { id: -1 }
      }
      default:
        return { id: -1 }
    }
  }

  private async buildSecondSalesAssignmentVisibilityWhere(currentUser: AuthenticatedUser, departmentId?: string): Promise<Prisma.SecondSalesAssignmentWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL: {
        const filteredDepartmentIds = departmentId ? [Number(departmentId)].filter(Number.isFinite) : null
        return filteredDepartmentIds?.length ? { secondSalesUser: { departmentId: { in: filteredDepartmentIds } } } : {}
      }
      case DataScope.SELF:
        return { secondSalesUserId: currentUser.id }
      case DataScope.DEPARTMENT:
      case DataScope.DEPARTMENT_AND_CHILDREN: {
        const departmentIds = await this.resolveFilteredDepartmentIds(currentUser, departmentId)
        return departmentIds ? { secondSalesUser: { departmentId: { in: departmentIds } } } : { id: -1 }
      }
      default:
        return { id: -1 }
    }
  }

  private async buildThirdSalesVisibilityWhere(currentUser: AuthenticatedUser, departmentId?: string): Promise<Prisma.ThirdSalesOrderWhereInput> {
    switch (currentUser.reportScope) {
      case DataScope.ALL: {
        const filteredDepartmentIds = departmentId ? [Number(departmentId)].filter(Number.isFinite) : null
        return filteredDepartmentIds?.length ? { thirdSalesUser: { departmentId: { in: filteredDepartmentIds } } } : {}
      }
      case DataScope.SELF:
        return { thirdSalesUserId: currentUser.id }
      case DataScope.DEPARTMENT:
      case DataScope.DEPARTMENT_AND_CHILDREN: {
        const departmentIds = await this.resolveFilteredDepartmentIds(currentUser, departmentId)
        return departmentIds ? { thirdSalesUser: { departmentId: { in: departmentIds } } } : { id: -1 }
      }
      default:
        return { id: -1 }
    }
  }
}
