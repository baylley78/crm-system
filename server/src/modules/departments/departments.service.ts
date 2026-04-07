import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, DataScope } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findTree(currentUser?: AuthenticatedUser) {
    const departments = await this.prisma.department.findMany({
      include: { leader: true, hrUser: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })

    let visibleDepartments = departments
    if (currentUser && !currentUser.permissions.includes('system.departments.view')) {
      const visibleIds = new Set(await this.getVisibleDepartmentIds(currentUser))
      visibleDepartments = departments.filter((item) => visibleIds.has(item.id))
    }

    const nodeMap = new Map(
      visibleDepartments.map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name,
          parentId: item.parentId,
          sort: item.sort,
          leaderUserId: item.leaderUserId ?? undefined,
          leaderName: item.leader?.realName,
          hrUserId: item.hrUserId ?? undefined,
          hrName: item.hrUser?.realName,
          children: [] as Array<any>,
        },
      ]),
    )

    const roots: Array<any> = []
    for (const item of visibleDepartments) {
      const node = nodeMap.get(item.id)!
      if (item.parentId && nodeMap.has(item.parentId)) {
        nodeMap.get(item.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  }

  async findDepartmentAndDescendantIds(departmentId: number) {
    await this.ensureDepartmentExists(departmentId)

    const departments = await this.prisma.department.findMany({
      select: { id: true, parentId: true },
      orderBy: { id: 'asc' },
    })

    const childrenMap = new Map<number, number[]>()
    for (const item of departments) {
      if (!item.parentId) {
        continue
      }
      const siblings = childrenMap.get(item.parentId) || []
      siblings.push(item.id)
      childrenMap.set(item.parentId, siblings)
    }

    const result: number[] = []
    const queue = [departmentId]
    while (queue.length) {
      const currentId = queue.shift()!
      result.push(currentId)
      const children = childrenMap.get(currentId) || []
      queue.push(...children)
    }

    return result
  }

  async findDepartmentIdsManagedByHrUser(userId: number) {
    const departments = await this.prisma.department.findMany({
      where: { hrUserId: userId },
      select: { id: true },
      orderBy: { id: 'asc' },
    })

    if (!departments.length) {
      return []
    }

    const result = new Set<number>()
    for (const department of departments) {
      const ids = await this.findDepartmentAndDescendantIds(department.id)
      ids.forEach((id) => result.add(id))
    }

    return Array.from(result).sort((a, b) => a - b)
  }

  async findDepartmentLeaderChain(departmentId: number, maxLevels = 3) {
    await this.ensureDepartmentExists(departmentId)

    const result: Array<{ departmentId: number; leaderUserId: number }> = []
    const seenLeaderIds = new Set<number>()
    let currentId: number | null = departmentId

    while (currentId && result.length < maxLevels) {
      const department = await this.prisma.department.findUnique({
        where: { id: currentId },
        select: { id: true, parentId: true, leaderUserId: true },
      })

      if (!department) {
        break
      }

      if (department.leaderUserId && !seenLeaderIds.has(department.leaderUserId)) {
        result.push({ departmentId: department.id, leaderUserId: department.leaderUserId })
        seenLeaderIds.add(department.leaderUserId)
      }

      currentId = department.parentId ?? null
    }

    return result
  }

  async create(dto: CreateDepartmentDto) {
    if (dto.parentId) {
      await this.ensureDepartmentExists(dto.parentId)
    }
    if (dto.leaderUserId) {
      await this.ensureUserExists(dto.leaderUserId)
    }
    if (dto.hrUserId) {
      await this.ensureUserExists(dto.hrUserId)
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        parentId: dto.parentId,
        sort: dto.sort ?? 0,
        leaderUserId: dto.leaderUserId,
        hrUserId: dto.hrUserId,
      },
    })
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    await this.ensureDepartmentExists(id)

    if (dto.parentId === id) {
      throw new BadRequestException('上级部门不能是自己')
    }

    if (dto.parentId) {
      await this.ensureDepartmentExists(dto.parentId)
    }
    if (dto.leaderUserId) {
      await this.ensureUserExists(dto.leaderUserId)
    }
    if (dto.hrUserId) {
      await this.ensureUserExists(dto.hrUserId)
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId,
        sort: dto.sort ?? 0,
        leaderUserId: dto.leaderUserId ?? null,
        hrUserId: dto.hrUserId ?? null,
      },
    })
  }

  async remove(id: number) {
    await this.ensureDepartmentExists(id)

    const childCount = await this.prisma.department.count({ where: { parentId: id } })
    if (childCount > 0) {
      throw new BadRequestException('请先删除下级部门')
    }

    const userCount = await this.prisma.user.count({ where: { departmentId: id } })
    if (userCount > 0) {
      throw new BadRequestException('该部门下已有用户，无法删除')
    }

    const leaderReferenceCount = await this.prisma.department.count({ where: { leaderUserId: { not: null }, id } })
    const hrReferenceCount = await this.prisma.department.count({ where: { hrUserId: { not: null }, id } })
    if (leaderReferenceCount > 0 || hrReferenceCount > 0) {
      await this.prisma.department.update({
        where: { id },
        data: {
          leaderUserId: null,
          hrUserId: null,
        },
      })
    }

    try {
      await this.prisma.department.delete({ where: { id } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('该部门仍被其他数据引用，无法删除，请先清理关联信息')
      }
      throw error
    }

    return { success: true }
  }

  private async getVisibleDepartmentIds(currentUser: AuthenticatedUser) {
    const hrManagedIds = await this.findDepartmentIdsManagedByHrUser(currentUser.id)
    if (hrManagedIds.length) {
      return hrManagedIds
    }

    if (currentUser.userManageScope === DataScope.ALL) {
      const departments = await this.prisma.department.findMany({ select: { id: true } })
      return departments.map((item) => item.id)
    }

    if (!currentUser.departmentId) {
      return []
    }

    if (currentUser.userManageScope === DataScope.SELF || currentUser.userManageScope === DataScope.DEPARTMENT) {
      return [currentUser.departmentId]
    }

    if (currentUser.userManageScope === DataScope.DEPARTMENT_AND_CHILDREN) {
      return this.findDepartmentAndDescendantIds(currentUser.departmentId)
    }

    return []
  }

  private async ensureDepartmentExists(id: number) {
    const department = await this.prisma.department.findUnique({ where: { id } })
    if (!department) {
      throw new NotFoundException('部门不存在')
    }
  }

  private async ensureUserExists(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new NotFoundException('负责人不存在')
    }
  }
}
