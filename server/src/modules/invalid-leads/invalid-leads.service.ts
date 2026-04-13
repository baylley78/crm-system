import { BadRequestException, Injectable } from '@nestjs/common'
import { DataScope, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { DepartmentsService } from '../departments/departments.service'
import { InvalidLeadsQueryDto } from './dto/invalid-leads-query.dto'
import { SaveInvalidLeadDto } from './dto/save-invalid-lead.dto'

type InvalidLeadRow = {
  id: number
  reportDate: Date
  userId: number
  departmentId: number | null
  phone: string
  createdAt: Date
  updatedAt: Date
  user?: {
    realName?: string | null
    departmentId?: number | null
    department?: string | null
    departmentInfo?: {
      name?: string | null
    } | null
  } | null
  department?: {
    name?: string | null
  } | null
}

@Injectable()
export class InvalidLeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async save(currentUser: AuthenticatedUser, dto: SaveInvalidLeadDto) {
    const reportDate = this.resolveReportDate(dto.reportDate)
    const phone = dto.phone.trim()

    try {
      const item = await this.prisma.invalidLead.create({
        data: {
          reportDate,
          userId: currentUser.id,
          departmentId: currentUser.departmentId ?? null,
          phone,
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        throw new BadRequestException('同一天已提交过该无效号码')
      }
      throw error
    }
  }

  async findRows(currentUser: AuthenticatedUser, query: InvalidLeadsQueryDto) {
    const where = await this.buildVisibilityWhere(currentUser, query.departmentId)
    const items = await this.prisma.invalidLead.findMany({
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

  private mapRow(item: InvalidLeadRow) {
    return {
      id: item.id,
      reportDate: this.toDateKey(item.reportDate),
      phone: item.phone,
      userId: item.userId,
      userName: item.user?.realName || '',
      salesName: item.user?.realName || '',
      departmentId: item.departmentId ?? item.user?.departmentId ?? undefined,
      departmentName: item.department?.name || item.user?.departmentInfo?.name || item.user?.department || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  private async buildVisibilityWhere(currentUser: AuthenticatedUser, requestedDepartmentId?: number) {
    const visibleDepartmentIds = await this.buildVisibleDepartmentIds(currentUser)

    if (currentUser.reportScope === DataScope.SELF) {
      if (requestedDepartmentId && currentUser.departmentId !== requestedDepartmentId) {
        return { userId: -1 }
      }
      return { userId: currentUser.id }
    }

    if (requestedDepartmentId) {
      if (visibleDepartmentIds && !visibleDepartmentIds.includes(requestedDepartmentId)) {
        return { userId: -1 }
      }
      return { departmentId: requestedDepartmentId }
    }

    if (visibleDepartmentIds) {
      return { departmentId: { in: visibleDepartmentIds } }
    }

    return {}
  }

  private async buildVisibleDepartmentIds(currentUser: AuthenticatedUser) {
    if (currentUser.reportScope === DataScope.ALL) {
      return null
    }

    if (!currentUser.departmentId) {
      return []
    }

    if (currentUser.reportScope === DataScope.SELF || currentUser.reportScope === DataScope.DEPARTMENT) {
      return [currentUser.departmentId]
    }

    if (currentUser.reportScope === DataScope.DEPARTMENT_AND_CHILDREN) {
      return this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId)
    }

    return []
  }

  private buildDateFilter(query: InvalidLeadsQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.startDate && !query.endDate) {
      return undefined
    }

    const filter: Prisma.DateTimeFilter = {}
    if (query.startDate) {
      filter.gte = new Date(query.startDate)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      if (!Number.isNaN(end.getTime())) {
        filter.lte = end
      }
    }
    return filter
  }

  private resolveReportDate(date: string) {
    const reportDate = new Date(date)
    if (Number.isNaN(reportDate.getTime())) {
      throw new BadRequestException('日期格式不正确')
    }
    reportDate.setHours(0, 0, 0, 0)
    return reportDate
  }

  private toDateKey(value: Date) {
    return value.toISOString().slice(0, 10)
  }

  private buildDepartmentPath(
    departmentId: number,
    itemMap: Map<number, { id: number; name: string; parentId: number | null }>,
  ) {
    const segments: string[] = []
    let current = itemMap.get(departmentId)

    while (current) {
      segments.unshift(current.name)
      current = current.parentId ? itemMap.get(current.parentId) : undefined
    }

    return segments.join(' / ')
  }
}
