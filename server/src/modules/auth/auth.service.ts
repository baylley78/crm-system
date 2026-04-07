import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { DataScope, Prisma, UserStatus } from '@prisma/client'
import { compare, hash } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { BUILT_IN_PERMISSION_DEFINITIONS, BUILT_IN_ROLE_CODES, BUILT_IN_ROLE_PERMISSION_CODES_BY_ROLE } from './built-in-auth'
import { LoginDto } from './dto/login.dto'
import { CreateUserDto } from './dto/create-user.dto'
import { RegisterUserDto } from './dto/register-user.dto'
import { CreateRoleDto } from './dto/create-role.dto'
import { CopyRoleDto } from './dto/copy-role.dto'
import { UpdateRoleMetaDto } from './dto/update-role-meta.dto'
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto'
import { UpdateRoleUsersDto } from './dto/update-role-users.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { BatchUpdateUserStatusDto } from './dto/batch-update-user-status.dto'

export interface AuthenticatedUser {
  id: number
  username: string
  realName: string
  phone?: string | null
  roleId: number
  roleCode: string
  roleName: string
  departmentId?: number | null
  department?: string | null
  permissions: string[]
  customerScope: DataScope
  reportScope: DataScope
  userManageScope: DataScope
}


type AuthTokenPayload = {
  sub: number
  type: 'access'
}

const UNASSIGNED_ROLE_CODE = 'UNASSIGNED'
const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN'
const FIRST_SALES_ROLE_CODES = ['SUPER_ADMIN', 'FIRST_SALES_MANAGER', 'FIRST_SALES_SUPERVISOR', 'FIRST_SALES']
const SECOND_SALES_ROLE_CODES = ['SUPER_ADMIN', 'SECOND_SALES_MANAGER', 'SECOND_SALES_SUPERVISOR', 'SECOND_SALES']
const LEGAL_ROLE_CODES = ['SUPER_ADMIN', 'LEGAL_MANAGER', 'LEGAL']
const MEDIATION_ROLE_CODES = ['SUPER_ADMIN', 'AFTER_SALES_MANAGER', 'AFTER_SALES', 'MEDIATION_SPECIALIST', 'LEGAL_MANAGER', 'LEGAL', 'SECOND_SALES_MANAGER', 'SECOND_SALES_SUPERVISOR', 'SECOND_SALES']
const THIRD_SALES_ROLE_CODES = ['SUPER_ADMIN', 'SECOND_SALES_MANAGER', 'SECOND_SALES_SUPERVISOR', 'SECOND_SALES', 'THIRD_SALES']

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { phone: dto.phone },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        departmentInfo: true,
      },
    })

    if (!user || !(await this.verifyPassword(dto.password, user.password))) {
      return null
    }

    if (!this.isHashedPassword(user.password)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: await this.hashPassword(dto.password) },
      })
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('账号已注册，等待后台审核')
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('账号已停用，请联系管理员')
    }

    if (user.role.code === UNASSIGNED_ROLE_CODE) {
      throw new UnauthorizedException('账号未分配权限组，请联系管理员')
    }

    return {
      token: this.signAccessToken(user.id),
      user: this.toAuthenticatedUser(user),
    }
  }

  async findRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permissionId: 'asc' },
        },
        _count: {
          select: {
            users: true,
            assignments: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    return roles.map((role) => this.toRoleItem(role))
  }

  async createRole(dto: CreateRoleDto) {
    await this.ensureRoleCodeAvailable(dto.code)
    await this.ensureValidPermissionIds(dto.permissionIds || [])

    const created = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          description: dto.description?.trim() || null,
          customerScope: dto.customerScope as DataScope,
          reportScope: dto.reportScope as DataScope,
          userManageScope: dto.userManageScope as DataScope,
        },
      })

      if (dto.permissionIds?.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        })
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          permissions: {
            include: { permission: true },
            orderBy: { permissionId: 'asc' },
          },
          _count: {
            select: {
              users: true,
              assignments: true,
            },
          },
        },
      })
    })

    return this.toRoleItem(created!)
  }

  async updateRoleMeta(roleId: number, dto: UpdateRoleMetaDto) {
    const existing = await this.getRoleOrThrow(roleId)
    await this.ensureRoleCodeAvailable(dto.code, roleId)

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description?.trim() || null,
        customerScope: dto.customerScope as DataScope,
        reportScope: dto.reportScope as DataScope,
        userManageScope: dto.userManageScope as DataScope,
      },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permissionId: 'asc' },
        },
        _count: {
          select: {
            users: true,
            assignments: true,
          },
        },
      },
    })

    return this.toRoleItem(updated)
  }

  async copyRole(roleId: number, dto: CopyRoleDto) {
    const sourceRole = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          select: { permissionId: true },
          orderBy: { permissionId: 'asc' },
        },
      },
    })
    if (!sourceRole) {
      throw new NotFoundException('角色不存在')
    }

    await this.ensureRoleCodeAvailable(dto.code)

    const copied = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          description: dto.description?.trim() || sourceRole.description,
          customerScope: sourceRole.customerScope,
          reportScope: sourceRole.reportScope,
          userManageScope: sourceRole.userManageScope,
        },
      })

      if (sourceRole.permissions.length) {
        await tx.rolePermission.createMany({
          data: sourceRole.permissions.map((item) => ({
            roleId: role.id,
            permissionId: item.permissionId,
          })),
        })
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          permissions: {
            include: { permission: true },
            orderBy: { permissionId: 'asc' },
          },
          _count: {
            select: {
              users: true,
              assignments: true,
            },
          },
        },
      })
    })

    return this.toRoleItem(copied!)
  }

  async deleteRole(roleId: number) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            users: true,
            assignments: true,
          },
        },
      },
    })
    if (!role) {
      throw new NotFoundException('角色不存在')
    }

    this.ensureRoleDeletable(role)

    if (role._count.users || role._count.assignments) {
      throw new BadRequestException('该角色下仍有关联人员，请先迁移人员后再删除')
    }

    await this.prisma.role.delete({ where: { id: roleId } })

    return { success: true }
  }

  async syncBuiltInRolePermissions() {
    await this.ensureBuiltInPermissions()
    const allPermissionCodes = await this.getAllPermissionCodes()
    const permissionCodesByRole: Record<string, string[]> = {
      ...BUILT_IN_ROLE_PERMISSION_CODES_BY_ROLE,
      SUPER_ADMIN: allPermissionCodes,
    }

    const roles = await this.prisma.role.findMany({
      where: { code: { in: Object.keys(permissionCodesByRole) } },
      select: { id: true, code: true },
    })

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: Array.from(new Set(Object.values(permissionCodesByRole).flat())) } },
      select: { id: true, code: true },
    })
    const permissionIdMap = new Map(permissions.map((item) => [item.code, item.id]))

    await this.prisma.$transaction(async (tx) => {
      for (const role of roles) {
        const permissionIds = (permissionCodesByRole[role.code] || [])
          .map((code) => permissionIdMap.get(code))
          .filter((permissionId): permissionId is number => Boolean(permissionId))

        await tx.rolePermission.deleteMany({ where: { roleId: role.id } })

        if (permissionIds.length) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          })
        }
      }
    })

    return { success: true, count: roles.length }
  }

  async findPermissions() {
    await this.ensureBuiltInPermissions()
    const permissions = await this.prisma.permission.findMany({
      orderBy: { id: 'asc' },
    })

    return permissions.map((permission) => ({
      id: permission.id,
      code: permission.code,
      name: permission.name,
      description: permission.description,
    }))
  }

  async findUsers(currentUser: AuthenticatedUser) {
    const manageableDepartmentIds = await this.getManageableDepartmentIds(currentUser)
    const users = await this.prisma.user.findMany({
      where: this.buildManagedUsersWhere(currentUser, manageableDepartmentIds),
      include: { role: true, departmentInfo: true },
      orderBy: { id: 'asc' },
    })

    return users.map((user) => this.toUserListItem(user))
  }

  async getVisibleDepartments(currentUser: AuthenticatedUser) {
    const departments = await this.prisma.department.findMany({
      include: { leader: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })

    const manageableDepartmentIds = await this.getManageableDepartmentIds(currentUser)
    const allowedIds = currentUser.permissions.includes('system.departments.view')
      ? null
      : new Set(manageableDepartmentIds)

    const filteredDepartments = allowedIds ? departments.filter((item) => allowedIds.has(item.id)) : departments

    const nodeMap = new Map(
      filteredDepartments.map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name,
          parentId: item.parentId,
          sort: item.sort,
          leaderUserId: item.leaderUserId ?? undefined,
          leaderName: item.leader?.realName,
          children: [] as Array<any>,
        },
      ]),
    )

    const roots: Array<any> = []
    for (const item of filteredDepartments) {
      const node = nodeMap.get(item.id)!
      if (item.parentId && nodeMap.has(item.parentId)) {
        nodeMap.get(item.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  }

  async getUserByToken(token: string): Promise<AuthenticatedUser> {
    let payload: AuthTokenPayload
    try {
      payload = jwt.verify(token, this.getAuthSecret()) as unknown as AuthTokenPayload
    } catch {
      throw new UnauthorizedException('登录信息无效')
    }

    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('登录信息无效')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        departmentInfo: true,
      },
    })

    if (!user || user.status !== UserStatus.ACTIVE || user.role.code === UNASSIGNED_ROLE_CODE) {
      throw new UnauthorizedException('登录信息无效')
    }

    return this.toAuthenticatedUser(user)
  }

  async createUser(currentUser: AuthenticatedUser, dto: CreateUserDto) {
    await this.ensureRoleExists(dto.roleId)
    await this.ensureUniqueFields(dto.phone, undefined, dto.phone)
    await this.ensureCanManageDepartment(currentUser, dto.departmentId)
    const department = await this.resolveDepartment(dto.departmentId)

    const user = await this.prisma.user.create({
      data: {
        username: dto.phone,
        password: await this.hashPassword(dto.password),
        realName: dto.realName,
        phone: dto.phone,
        department: department?.name || dto.department,
        departmentId: department?.id,
        roleId: dto.roleId,
        status: dto.status as UserStatus,
        roleAssignments: {
          create: {
            roleId: dto.roleId,
          },
        },
      },
      include: { role: true, departmentInfo: true },
    })

    return this.toUserListItem(user)
  }

  async register(dto: RegisterUserDto) {
    await this.ensureUniqueFields(dto.phone, undefined, dto.phone)
    const department = await this.resolveDepartment(dto.departmentId)
    const firstSalesRoleId = await this.getFirstSalesRoleId()

    await this.prisma.user.create({
      data: {
        username: dto.phone,
        password: await this.hashPassword(dto.password),
        realName: dto.realName,
        phone: dto.phone,
        department: department?.name || dto.department,
        departmentId: department?.id,
        roleId: firstSalesRoleId,
        status: UserStatus.PENDING,
      },
    })

    return { success: true, message: '注册成功，请等待后台审核' }
  }

  async updateUser(currentUser: AuthenticatedUser, id: number, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('用户不存在')
    }

    await this.ensureCanManageExistingUser(currentUser, existing)
    await this.ensureRoleExists(dto.roleId)
    await this.ensureUniqueFields(dto.phone, id, dto.phone)
    await this.ensureCanManageDepartment(currentUser, dto.departmentId)
    const department = await this.resolveDepartment(dto.departmentId)

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        username: dto.phone,
        realName: dto.realName,
        phone: dto.phone,
        department: department?.name || dto.department,
        departmentId: department?.id ?? null,
        roleId: dto.roleId,
        status: dto.status as UserStatus,
        ...(dto.password?.trim() ? { password: await this.hashPassword(dto.password) } : {}),
      },
      include: { role: true, departmentInfo: true },
    })

    return this.toUserListItem(user)
  }

  async updateRolePermissions(roleId: number, dto: UpdateRolePermissionsDto) {
    await this.getRoleOrThrow(roleId)
    await this.ensureValidPermissionIds(dto.permissionIds)

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          customerScope: dto.customerScope as DataScope,
          reportScope: dto.reportScope as DataScope,
          userManageScope: dto.userManageScope as DataScope,
        },
      })

      await tx.rolePermission.deleteMany({ where: { roleId } })

      if (dto.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        })
      }
    })

    const updated = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permissionId: 'asc' },
        },
        _count: {
          select: {
            users: true,
            assignments: true,
          },
        },
      },
    })

    return this.toRoleItem(updated!)
  }

  async findRoleUsers(currentUser: AuthenticatedUser, roleId: number) {
    await this.ensureRoleExists(roleId)
    const manageableDepartmentIds = await this.getManageableDepartmentIds(currentUser)
    const users = await this.prisma.user.findMany({
      where: this.buildManagedUsersWhere(currentUser, manageableDepartmentIds),
      include: {
        role: true,
        departmentInfo: true,
        roleAssignments: {
          select: { roleId: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    const assignedUsers = users
      .filter((user) => user.roleAssignments.some((assignment) => assignment.roleId === roleId))
      .map((user) => this.toUserListItem(user))
    const availableUsers = users
      .filter((user) => !user.roleAssignments.some((assignment) => assignment.roleId === roleId))
      .map((user) => this.toUserListItem(user))

    return {
      assignedUsers,
      availableUsers,
    }
  }

  async updateRoleUsers(currentUser: AuthenticatedUser, roleId: number, dto: UpdateRoleUsersDto) {
    await this.ensureRoleExists(roleId)

    if (!dto.userIds.length) {
      return this.findRoleUsers(currentUser, roleId)
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds } },
      select: { id: true, departmentId: true },
    })

    if (users.length !== dto.userIds.length) {
      throw new NotFoundException('存在不存在的用户')
    }

    for (const user of users) {
      await this.ensureCanManageExistingUser(currentUser, user)
    }

    if (dto.removeToFirstSales) {
      await this.prisma.roleAssignment.deleteMany({
        where: {
          roleId,
          userId: { in: dto.userIds },
        },
      })
    } else {
      await this.prisma.roleAssignment.createMany({
        data: dto.userIds.map((userId) => ({ roleId, userId })),
      })
    }

    return this.findRoleUsers(currentUser, roleId)
  }

  async deleteUser(currentUser: AuthenticatedUser, id: number) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    })
    if (!existing) {
      throw new NotFoundException('用户不存在')
    }

    if (existing.id === currentUser.id) {
      throw new BadRequestException('不能删除当前登录用户')
    }

    if (existing.role.code === SUPER_ADMIN_ROLE_CODE) {
      throw new BadRequestException('不能删除管理员账号')
    }

    await this.ensureCanManageExistingUser(currentUser, existing)

    const deletionBlockReason = await this.getUserDeletionBlockReason(id)
    if (deletionBlockReason) {
      throw new BadRequestException(deletionBlockReason)
    }

    try {
      await this.prisma.user.delete({ where: { id } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('该用户已有关联业务数据，无法删除，请先改为离职')
      }
      throw error
    }

    return { success: true }
  }

  async updateUsersStatusBatch(currentUser: AuthenticatedUser, dto: BatchUpdateUserStatusDto) {
    const uniqueUserIds = Array.from(new Set(dto.userIds))
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      include: { role: true },
    })

    if (users.length !== uniqueUserIds.length) {
      throw new NotFoundException('存在不存在的用户')
    }

    for (const user of users) {
      await this.ensureCanManageExistingUser(currentUser, user)
      if (user.id === currentUser.id && dto.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('不能批量停用当前登录用户')
      }
      if (user.role.code === SUPER_ADMIN_ROLE_CODE && dto.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('不能批量停用管理员账号')
      }
    }

    await this.prisma.user.updateMany({
      where: { id: { in: uniqueUserIds } },
      data: { status: dto.status as UserStatus },
    })

    return { success: true, count: uniqueUserIds.length }
  }

  private async getUserDeletionBlockReason(userId: number) {
    const [
      ownedCustomerCount,
      followLogCount,
      secondSalesAssignmentCount,
      secondSalesAssignedByCount,
      firstSalesOrderCount,
      secondSalesOrderCount,
      thirdSalesOrderCount,
      approvalApplicantCount,
      approvalApproverCount,
      approvalStepCount,
      qualityRecordCount,
      contractArchiveCount,
      mediationCaseCount,
      legalCaseCount,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: {
          OR: [
            { currentOwnerId: userId },
            { firstSalesUserId: userId },
            { secondSalesUserId: userId },
            { legalUserId: userId },
            { thirdSalesUserId: userId },
          ],
        },
      }),
      this.prisma.customerFollowLog.count({ where: { operatorId: userId } }),
      this.prisma.secondSalesAssignment.count({ where: { secondSalesUserId: userId } }),
      this.prisma.secondSalesAssignment.count({ where: { assignedById: userId } }),
      this.prisma.firstSalesOrder.count({ where: { salesUserId: userId } }),
      this.prisma.secondSalesOrder.count({ where: { secondSalesUserId: userId } }),
      this.prisma.thirdSalesOrder.count({ where: { thirdSalesUserId: userId } }),
      this.prisma.approval.count({ where: { applicantId: userId } }),
      this.prisma.approval.count({ where: { approverId: userId } }),
      this.prisma.approvalStep.count({ where: { approverId: userId } }),
      this.prisma.qualityRecord.count({ where: { responsibleId: userId } }),
      this.prisma.contractArchive.count({ where: { contractSpecialistId: userId } }),
      this.prisma.mediationCase.count({ where: { ownerId: userId } }),
      this.prisma.legalCase.count({ where: { legalUserId: userId } }),
    ])

    if (ownedCustomerCount > 0) {
      return '该员工名下仍有关联客户，无法删除，请先调整客户归属或改为离职'
    }
    if (secondSalesAssignmentCount > 0 || secondSalesAssignedByCount > 0) {
      return '该员工已有二销分配记录，无法删除，请先改为离职'
    }
    if (firstSalesOrderCount > 0 || secondSalesOrderCount > 0 || thirdSalesOrderCount > 0) {
      return '该员工已有业绩订单记录，无法删除，请先改为离职'
    }
    if (followLogCount > 0) {
      return '该员工已有客户跟进记录，无法删除，请先改为离职'
    }
    if (approvalApplicantCount > 0 || approvalApproverCount > 0 || approvalStepCount > 0) {
      return '该员工已有审批记录，无法删除，请先改为离职'
    }
    if (qualityRecordCount > 0) {
      return '该员工已有质检记录，无法删除，请先改为离职'
    }
    if (contractArchiveCount > 0) {
      return '该员工已有合同归档记录，无法删除，请先改为离职'
    }
    if (mediationCaseCount > 0 || legalCaseCount > 0) {
      return '该员工已有法务或调解业务记录，无法删除，请先改为离职'
    }

    return null
  }

  private async getAllPermissionCodes() {
    const permissions = await this.prisma.permission.findMany({ select: { code: true }, orderBy: { id: 'asc' } })
    return permissions.map((item) => item.code)
  }

  private async ensureBuiltInPermissions() {
    const existing = await this.prisma.permission.findMany({
      where: { code: { in: BUILT_IN_PERMISSION_DEFINITIONS.map((item) => item.code) } },
      select: { code: true },
    })

    const existingCodes = new Set(existing.map((item) => item.code))
    const missing = BUILT_IN_PERMISSION_DEFINITIONS.filter((item) => !existingCodes.has(item.code))

    if (missing.length) {
      await this.prisma.permission.createMany({
        data: missing.map((item) => ({
          code: item.code,
          name: item.name,
          description: item.description,
        })),
      })
    }
  }

  private async getFirstSalesRoleId() {
    const role = await this.prisma.role.findFirst({ where: { code: { in: ['FIRST_SALES', 'FIRST_SALES_SUPERVISOR', 'FIRST_SALES_MANAGER'] } }, orderBy: { id: 'asc' } })
    if (!role) {
      throw new NotFoundException('默认一销销售角色不存在')
    }

    return role.id
  }

  private async getRoleOrThrow(roleId: number) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      throw new NotFoundException('角色不存在')
    }

    return role
  }

  private async ensureRoleExists(roleId: number) {
    await this.getRoleOrThrow(roleId)
  }

  private async ensureRoleCodeAvailable(code: string, excludeId?: number) {
    const normalizedCode = code.trim().toUpperCase()
    const existing = await this.prisma.role.findFirst({
      where: {
        code: normalizedCode,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (existing) {
      throw new BadRequestException('角色编码已存在')
    }
  }

  private async ensureValidPermissionIds(permissionIds: number[]) {
    if (!permissionIds.length) {
      return
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    })

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('存在无效的权限项')
    }
  }

  private ensureRoleDeletable(role: { code: string }) {
    if ((BUILT_IN_ROLE_CODES as readonly string[]).includes(role.code)) {
      throw new BadRequestException('系统内置角色不允许删除')
    }
  }

  private toRoleItem(role: {
    id: number
    name: string
    code: string
    description: string | null
    customerScope: DataScope
    reportScope: DataScope
    userManageScope: DataScope
    permissions: Array<{ permission: { id: number; code: string; name: string } }>
    _count?: { users: number; assignments: number }
  }) {
    return {
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      customerScope: role.customerScope,
      reportScope: role.reportScope,
      userManageScope: role.userManageScope,
      isSystem: (BUILT_IN_ROLE_CODES as readonly string[]).includes(role.code),
      userCount: (role._count?.users || 0) + (role._count?.assignments || 0),
      permissions: role.permissions.map((item) => ({
        id: item.permission.id,
        code: item.permission.code,
        name: item.permission.name,
      })),
    }
  }

  private async resolveDepartment(departmentId?: number) {
    if (!departmentId) {
      return null
    }

    const department = await this.prisma.department.findUnique({ where: { id: departmentId } })
    if (!department) {
      throw new NotFoundException('部门不存在')
    }

    return department
  }

  private async ensureUniqueFields(phone: string, excludeId?: number, username?: string) {
    const normalizedUsername = username?.trim()

    const existingByPhone = await this.prisma.user.findFirst({
      where: {
        phone,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (existingByPhone) {
      throw new BadRequestException('手机号已存在')
    }

    if (normalizedUsername) {
      const existingByUsername = await this.prisma.user.findFirst({
        where: {
          username: normalizedUsername,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      })

      if (existingByUsername) {
        throw new BadRequestException('登录账号已存在')
      }
    }
  }

  private async getManageableDepartmentIds(currentUser: AuthenticatedUser) {
    const hrManagedDepartmentIds = await this.departmentsService.findDepartmentIdsManagedByHrUser(currentUser.id)
    if (hrManagedDepartmentIds.length) {
      return hrManagedDepartmentIds
    }

    if (currentUser.userManageScope === DataScope.ALL) {
      const departments = await this.prisma.department.findMany({ select: { id: true } })
      return departments.map((item) => item.id)
    }

    if (!currentUser.departmentId) {
      return []
    }

    if (currentUser.userManageScope === DataScope.SELF) {
      return [currentUser.departmentId]
    }

    if (currentUser.userManageScope === DataScope.DEPARTMENT) {
      return [currentUser.departmentId]
    }

    if (currentUser.userManageScope === DataScope.DEPARTMENT_AND_CHILDREN) {
      return this.departmentsService.findDepartmentAndDescendantIds(currentUser.departmentId)
    }

    return []
  }

  private buildManagedUsersWhere(currentUser: AuthenticatedUser, manageableDepartmentIds: number[]): Prisma.UserWhereInput {
    if (currentUser.userManageScope === DataScope.ALL) {
      return {}
    }

    const orConditions: Prisma.UserWhereInput[] = [
      { id: currentUser.id },
      ...(manageableDepartmentIds.length ? [{ departmentId: { in: manageableDepartmentIds } }] : []),
    ]

    if (currentUser.permissions.includes('system.users.status')) {
      orConditions.push({ status: UserStatus.PENDING })
    }

    return {
      OR: orConditions,
    }
  }

  private async ensureCanManageDepartment(currentUser: AuthenticatedUser, departmentId?: number) {
    if (!departmentId || currentUser.userManageScope === DataScope.ALL) {
      return
    }

    const manageableDepartmentIds = await this.getManageableDepartmentIds(currentUser)
    if (!manageableDepartmentIds.includes(departmentId)) {
      throw new ForbiddenException('无权操作该部门下的用户')
    }
  }

  private async ensureCanManageExistingUser(currentUser: AuthenticatedUser, targetUser: { id: number; departmentId: number | null; status?: UserStatus }) {
    if (currentUser.userManageScope === DataScope.ALL || currentUser.id === targetUser.id) {
      return
    }

    if (!targetUser.departmentId) {
      if (targetUser.status === UserStatus.PENDING && currentUser.permissions.includes('system.users.status')) {
        return
      }
      throw new ForbiddenException('无权操作该用户')
    }

    const manageableDepartmentIds = await this.getManageableDepartmentIds(currentUser)
    if (!manageableDepartmentIds.includes(targetUser.departmentId)) {
      throw new ForbiddenException('无权操作该用户')
    }
  }

  private async hashPassword(password: string) {
    return hash(password, 10)
  }

  private async verifyPassword(input: string, stored: string) {
    if (this.isHashedPassword(stored)) {
      return compare(input, stored)
    }

    return input === stored
  }

  private isHashedPassword(value: string) {
    return value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$')
  }

  private signAccessToken(userId: number) {
    return jwt.sign({ sub: userId, type: 'access' } satisfies AuthTokenPayload, this.getAuthSecret(), { expiresIn: '7d' })
  }

  private getAuthSecret() {
    const secret = process.env.AUTH_TOKEN_SECRET
    if (!secret) {
      throw new UnauthorizedException('系统未配置认证密钥')
    }
    return secret
  }

  private toUserListItem(user: { id: number; username: string; realName: string; phone: string | null; department: string | null; departmentId: number | null; status: UserStatus; createdAt: Date; role: { code: string; name: string; id?: number }; departmentInfo?: { name: string } | null }) {
    return {
      id: user.id,
      realName: user.realName,
      phone: user.phone,
      roleCode: user.role.code,
      roleName: user.role.name,
      departmentId: user.departmentId,
      department: user.departmentInfo?.name || user.department,
      status: user.status,
      createdAt: user.createdAt,
    }
  }

  private toAuthenticatedUser(user: { id: number; username: string; realName: string; phone: string | null; department: string | null; departmentId: number | null; roleId: number; role: { code: string; name: string; customerScope: DataScope; reportScope: DataScope; userManageScope: DataScope; permissions: Array<{ permission: { code: string } }> }; departmentInfo?: { name: string } | null }): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      phone: user.phone,
      roleId: user.roleId,
      roleCode: user.role.code,
      roleName: user.role.name,
      departmentId: user.departmentId,
      department: user.departmentInfo?.name || user.department,
      permissions: user.role.permissions.map((item) => item.permission.code),
      customerScope: user.role.customerScope,
      reportScope: user.role.reportScope,
      userManageScope: user.role.userManageScope,
    }
  }
}
