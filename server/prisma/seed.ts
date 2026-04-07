import 'dotenv/config'
import { AssignmentStatus, CustomerStatus, DataScope, FinanceReviewStatus, FirstOrderType, PrismaClient, UserStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'
import { BUILT_IN_PERMISSION_DEFINITIONS, BUILT_IN_ROLE_DEFINITIONS } from '../src/modules/auth/built-in-auth'

type DepartmentSeedNode = {
  name: string
  children?: DepartmentSeedNode[]
}

type RoleSeed = {
  name: string
  code: string
  description: string
  customerScope: DataScope
  reportScope: DataScope
  userManageScope: DataScope
  permissionCodes: string[]
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || '' }),
})

const permissionSeeds = BUILT_IN_PERMISSION_DEFINITIONS.map((item) => ({
  code: item.code,
  name: item.name,
}))

const roleSeeds: RoleSeed[] = BUILT_IN_ROLE_DEFINITIONS.map((role) => ({
  name: role.name,
  code: role.code,
  description: role.description,
  customerScope: role.customerScope,
  reportScope: role.reportScope,
  userManageScope: role.userManageScope,
  permissionCodes: role.permissionCodes,
}))

const roleCodesToKeep = roleSeeds.map((item) => item.code)

const departmentTreeSeeds: DepartmentSeedNode[] = [
  { name: '总经办' },
  {
    name: '和晟团队',
    children: [
      {
        name: '一销团队',
        children: [
          {
            name: '宏发一组',
            children: [{ name: '销售一部' }, { name: '销售二部' }],
          },
          {
            name: '宏发二组',
            children: [{ name: '销售三部' }, { name: '销售四部' }],
          },
          {
            name: '商鼎一组',
            children: [{ name: '销售五部' }, { name: '销售六部' }],
          },
          {
            name: '商鼎二组',
            children: [{ name: '销售七部' }, { name: '销售八部' }],
          },
          {
            name: '宏发三组',
            children: [{ name: '销售九部' }, { name: '销售十部' }],
          },
        ],
      },
      {
        name: '二销团队',
        children: [{ name: '起诉一组' }, { name: '起诉二部' }],
      },
      {
        name: '和晟总部',
        children: [
          { name: '宏发一组人事' },
          { name: '宏发二组人事' },
          { name: '商鼎一组人事' },
          { name: '商鼎二组人事' },
          { name: '宏发三组人事' },
        ],
      },
    ],
  },
  {
    name: '星宏团队',
    children: [
      {
        name: '一销团队',
        children: [
          {
            name: '星宏组',
            children: [{ name: '星宏一部' }, { name: '星宏二部' }],
          },
          {
            name: '广点通组',
            children: [{ name: '广点通一部' }, { name: '广点通二部' }],
          },
        ],
      },
      {
        name: '二销团队',
        children: [{ name: '星宏二销部' }, { name: '广点通二销部' }],
      },
      {
        name: '人事团队',
        children: [{ name: '星宏人事部' }, { name: '广点通人事部' }],
      },
    ],
  },
  {
    name: '鑫豪团队',
    children: [
      {
        name: '一销团队',
        children: [
          {
            name: '鑫豪一组',
            children: [{ name: '鑫豪一部' }, { name: '鑫豪二部' }],
          },
        ],
      },
      {
        name: '二销团队',
        children: [{ name: '鑫豪二销部' }],
      },
      {
        name: '人事团队',
        children: [{ name: '鑫豪人事部' }],
      },
    ],
  },
  {
    name: '华胜团队',
    children: [
      {
        name: '一销团队',
        children: [
          {
            name: '华胜一组',
            children: [{ name: '华胜一部' }, { name: '华胜二部' }],
          },
        ],
      },
      {
        name: '二销团队',
        children: [{ name: '华胜二销部' }],
      },
      {
        name: '人事团队',
        children: [{ name: '华胜人事部' }],
      },
    ],
  },
  { name: '人事部' },
  { name: '财务部' },
  { name: '调解部' },
  { name: '法务部' },
  { name: '文职部' },
  { name: '合同部' },
]

async function upsertDepartmentTree(nodes: DepartmentSeedNode[], parentId?: number) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const department = parentId !== undefined
      ? await prisma.department.upsert({
          where: {
            name_parentId: {
              name: node.name,
              parentId,
            },
          },
          update: {
            name: node.name,
            parentId,
            sort: index,
          },
          create: {
            name: node.name,
            parentId,
            sort: index,
          },
        })
      : await prisma.department.upsert({
          where: {
            id: (await prisma.department.findFirst({ where: { name: node.name, parentId: null }, select: { id: true } }))?.id ?? 0,
          },
          update: {
            name: node.name,
            sort: index,
          },
          create: {
            name: node.name,
            sort: index,
          },
        })

    if (node.children?.length) {
      await upsertDepartmentTree(node.children, department.id)
    }
  }
}

async function main() {
  const adminPassword = await hash('happy587', 10)
  const demoPassword = await hash('123456', 10)

  const permissions = await Promise.all(
    permissionSeeds.map((item) =>
      prisma.permission.upsert({
        where: { code: item.code },
        update: { name: item.name },
        create: item,
      }),
    ),
  )

  const permissionMap = new Map(permissions.map((item) => [item.code, item.id]))

  const existingBuiltInRoles = await prisma.role.findMany({
    where: { code: { notIn: roleCodesToKeep } },
    select: { id: true },
  })
  const existingBuiltInRoleIds = existingBuiltInRoles.map((item) => item.id)

  if (existingBuiltInRoleIds.length) {
    await prisma.roleAssignment.deleteMany({
      where: {
        roleId: { in: existingBuiltInRoleIds },
      },
    })

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: { in: existingBuiltInRoleIds },
      },
    })
  }

  const roleMap = new Map<number | string, { id: number; code: string }>()

  for (const roleSeed of roleSeeds) {
    const role = await prisma.role.upsert({
      where: { code: roleSeed.code },
      update: {
        name: roleSeed.name,
        description: roleSeed.description,
        customerScope: roleSeed.customerScope,
        reportScope: roleSeed.reportScope,
        userManageScope: roleSeed.userManageScope,
      },
      create: {
        name: roleSeed.name,
        code: roleSeed.code,
        description: roleSeed.description,
        customerScope: roleSeed.customerScope,
        reportScope: roleSeed.reportScope,
        userManageScope: roleSeed.userManageScope,
      },
    })
    roleMap.set(role.code, role)
  }

  const existingUserIds = (await prisma.user.findMany({ select: { id: true } })).map((item) => item.id)
  const roleIds = Array.from(roleMap.values()).map((item) => item.id)
  const unassignedRoleId = roleMap.get('UNASSIGNED')!.id
  const superAdminRoleId = roleMap.get('SUPER_ADMIN')!.id
  const secondSalesRoleId = roleMap.get('SECOND_SALES')!.id
  const hrRoleId = roleMap.get('HR')!.id
  const firstSalesRoleId = roleMap.get('FIRST_SALES')!.id
  const thirdSalesRoleId = roleMap.get('THIRD_SALES')!.id
  const legalRoleId = roleMap.get('LEGAL')!.id

  if (existingUserIds.length) {
    await prisma.approvalStep.deleteMany({ where: { approverId: { in: existingUserIds } } })
    await prisma.approval.deleteMany({ where: { applicantId: { in: existingUserIds } } })
    await prisma.approval.deleteMany({ where: { approverId: { in: existingUserIds } } })
    await prisma.contractArchive.deleteMany({ where: { contractSpecialistId: { in: existingUserIds } } })
    await prisma.qualityRecord.deleteMany({ where: { responsibleId: { in: existingUserIds } } })
    await prisma.thirdSalesOrder.deleteMany({ where: { thirdSalesUserId: { in: existingUserIds } } })
    await prisma.thirdSalesOrder.deleteMany({ where: { financeReviewerId: { in: existingUserIds } } })
    await prisma.legalCase.deleteMany({ where: { legalUserId: { in: existingUserIds } } })
    await prisma.mediationCase.deleteMany({ where: { ownerId: { in: existingUserIds } } })
    await prisma.secondSalesOrder.deleteMany({ where: { secondSalesUserId: { in: existingUserIds } } })
    await prisma.secondSalesOrder.deleteMany({ where: { financeReviewerId: { in: existingUserIds } } })
    await prisma.secondSalesAssignment.deleteMany({ where: { secondSalesUserId: { in: existingUserIds } } })
    await prisma.secondSalesAssignment.deleteMany({ where: { assignedById: { in: existingUserIds } } })
    await prisma.firstSalesOrder.deleteMany({ where: { salesUserId: { in: existingUserIds } } })
    await prisma.firstSalesOrder.deleteMany({ where: { financeReviewerId: { in: existingUserIds } } })
    await prisma.customerFollowLog.deleteMany({ where: { operatorId: { in: existingUserIds } } })
    await prisma.customer.updateMany({
      data: {
        currentOwnerId: null,
        firstSalesUserId: null,
        secondSalesUserId: null,
        legalUserId: null,
        thirdSalesUserId: null,
      },
    })
    await prisma.department.updateMany({ data: { leaderUserId: null, hrUserId: null } })
    await prisma.user.updateMany({
      where: {
        username: { not: 'admin' },
      },
      data: {
        roleId: unassignedRoleId,
      },
    })
  }


  await prisma.rolePermission.deleteMany({
    where: {
      roleId: { in: roleIds },
    },
  })

  const rolePermissionRows = roleSeeds.flatMap((roleSeed) =>
    roleSeed.permissionCodes
      .map((code) => permissionMap.get(code))
      .filter((permissionId): permissionId is number => Boolean(permissionId))
      .map((permissionId) => ({
        roleId: roleMap.get(roleSeed.code)!.id,
        permissionId,
      })),
  )

  if (rolePermissionRows.length) {
    await prisma.rolePermission.createMany({
      data: rolePermissionRows,
    })
  }

  await upsertDepartmentTree(departmentTreeSeeds)

  const managementDepartment = await prisma.department.findFirst({ where: { name: '总经办', parentId: null } })
  const hrDepartment = await prisma.department.findFirst({ where: { name: '人事部', parentId: null } })
  const firstSalesDepartment = await prisma.department.findFirst({ where: { name: '一销团队' } })
  const secondSalesDepartment = await prisma.department.findFirst({ where: { name: '二销团队' } })
  const thirdSalesDepartment = await prisma.department.findFirst({ where: { name: '三销团队' } })
  const legalDepartment = await prisma.department.findFirst({ where: { name: '法务部' } })
  await prisma.roleAssignment.deleteMany({})

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      realName: '系统管理员',
      password: adminPassword,
      phone: '13551199905',
      roleId: superAdminRoleId,
      department: managementDepartment?.name || '总经办',
      departmentId: managementDepartment?.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: 'admin',
      password: adminPassword,
      realName: '系统管理员',
      phone: '13551199905',
      department: managementDepartment?.name || '总经办',
      departmentId: managementDepartment?.id,
      status: UserStatus.ACTIVE,
      roleId: superAdminRoleId,
    },
  })

  const firstSalesUser = await prisma.user.upsert({
    where: { username: 'sales01' },
    update: {
      password: demoPassword,
      realName: '一销王顾问',
      phone: '13800000001',
      roleId: firstSalesRoleId,
      department: firstSalesDepartment?.name || '一销团队',
      departmentId: firstSalesDepartment?.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: 'sales01',
      password: demoPassword,
      realName: '一销王顾问',
      phone: '13800000001',
      department: firstSalesDepartment?.name || '一销团队',
      departmentId: firstSalesDepartment?.id,
      status: UserStatus.ACTIVE,
      roleId: firstSalesRoleId,
    },
  })

  const secondSalesUser = await prisma.user.upsert({
    where: { username: 'sales02' },
    update: {
      password: demoPassword,
      realName: '二销李顾问',
      phone: '13800000002',
      roleId: secondSalesRoleId,
      department: secondSalesDepartment?.name || '二销团队',
      departmentId: secondSalesDepartment?.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: 'sales02',
      password: demoPassword,
      realName: '二销李顾问',
      phone: '13800000002',
      department: secondSalesDepartment?.name || '二销团队',
      departmentId: secondSalesDepartment?.id,
      status: UserStatus.ACTIVE,
      roleId: secondSalesRoleId,
    },
  })

  const thirdSalesUser = await prisma.user.upsert({
    where: { username: 'sales03' },
    update: {
      password: demoPassword,
      realName: '三销赵顾问',
      phone: '13800000004',
      roleId: thirdSalesRoleId,
      department: thirdSalesDepartment?.name || '三销团队',
      departmentId: thirdSalesDepartment?.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: 'sales03',
      password: demoPassword,
      realName: '三销赵顾问',
      phone: '13800000004',
      department: thirdSalesDepartment?.name || '三销团队',
      departmentId: thirdSalesDepartment?.id,
      status: UserStatus.ACTIVE,
      roleId: thirdSalesRoleId,
    },
  })

  const legalUser = await prisma.user.upsert({
    where: { username: 'legal01' },
    update: {
      password: demoPassword,
      realName: '法务陈顾问',
      phone: '13800000005',
      roleId: legalRoleId,
      department: legalDepartment?.name || '法务部',
      departmentId: legalDepartment?.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: 'legal01',
      password: demoPassword,
      realName: '法务陈顾问',
      phone: '13800000005',
      department: legalDepartment?.name || '法务部',
      departmentId: legalDepartment?.id,
      status: UserStatus.ACTIVE,
      roleId: legalRoleId,
    },
  })

  const hrUser = await prisma.user.upsert({
    where: { username: 'hr01' },
    update: {
      password: demoPassword,
      realName: '人事专员',
      phone: '13800000003',
      roleId: hrRoleId,
      department: hrDepartment?.name || '人事部',
      departmentId: hrDepartment?.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: 'hr01',
      password: demoPassword,
      realName: '人事专员',
      phone: '13800000003',
      department: hrDepartment?.name || '人事部',
      departmentId: hrDepartment?.id,
      status: UserStatus.ACTIVE,
      roleId: hrRoleId,
    },
  })

  await prisma.roleAssignment.createMany({
    data: [
      { roleId: superAdminRoleId, userId: (await prisma.user.findUniqueOrThrow({ where: { username: 'admin' }, select: { id: true } })).id },
      { roleId: firstSalesRoleId, userId: firstSalesUser.id },
      { roleId: secondSalesRoleId, userId: secondSalesUser.id },
      { roleId: thirdSalesRoleId, userId: thirdSalesUser.id },
      { roleId: legalRoleId, userId: legalUser.id },
      { roleId: hrRoleId, userId: hrUser.id },
    ],
  })

  const existingPaymentAccount = await prisma.paymentAccount.findFirst({
    where: { accountNo: '6222020202020202020' },
    select: { id: true },
  })
  const paymentAccount = existingPaymentAccount
    ? await prisma.paymentAccount.update({
        where: { id: existingPaymentAccount.id },
        data: {
          accountName: '对公测试账户',
          bankName: '中国银行',
          isActive: true,
        },
      })
    : await prisma.paymentAccount.create({
        data: {
          accountName: '对公测试账户',
          bankName: '中国银行',
          accountNo: '6222020202020202020',
          isActive: true,
        },
      })

  await prisma.courtConfig.upsert({
    where: { id: 1 },
    update: {
      hearingCost: 500,
      remark: 'seed default',
    },
    create: {
      id: 1,
      hearingCost: 500,
      remark: 'seed default',
    },
  })

  await prisma.thirdSalesOrder.deleteMany({
    where: { paymentSerialNo: { startsWith: 'SEED-TS-' } },
  })
  await prisma.legalCase.deleteMany({
    where: { remark: { startsWith: 'seed-case-' } },
  })
  await prisma.secondSalesOrder.deleteMany({
    where: { paymentSerialNo: { startsWith: 'SEED-SS-' } },
  })
  await prisma.secondSalesAssignment.deleteMany({
    where: { remark: { startsWith: 'seed-assignment-' } },
  })
  await prisma.firstSalesOrder.deleteMany({
    where: { paymentSerialNo: { startsWith: 'SEED-FS-' } },
  })
  await prisma.customer.deleteMany({
    where: { customerNo: { startsWith: 'SEED-CUST-' } },
  })

  const orderDates = [
    new Date('2026-04-05T10:00:00.000Z'),
    new Date('2026-04-06T10:00:00.000Z'),
    new Date('2026-04-07T10:00:00.000Z'),
  ]

  const seededCustomers = [] as Array<{ id: number; index: number }>
  for (const index of [1, 2, 3]) {
    const customer = await prisma.customer.create({
      data: {
        customerNo: `SEED-CUST-00${index}`,
        name: `压测客户${index}`,
        phone: `1390000000${index}`,
        wechat: `seed_wechat_${index}`,
        gender: index % 2 === 0 ? '女' : '男',
        age: 30 + index,
        province: '广东',
        city: '深圳',
        source: 'SEED',
        caseType: '合同纠纷',
        intentionLevel: 'A',
        currentStatus: CustomerStatus.PENDING_THIRD_SALES,
        currentOwnerId: firstSalesUser.id,
        firstSalesUserId: firstSalesUser.id,
        secondSalesUserId: secondSalesUser.id,
        legalUserId: legalUser.id,
        thirdSalesUserId: thirdSalesUser.id,
        thirdSalesSourceStage: 'LEGAL',
        targetAmount: 10000 * index,
        firstPaymentAmount: 3000 * index,
        secondPaymentAmount: 2000 * index,
        thirdPaymentAmount: 1500 * index,
        totalPaymentAmount: 6500 * index,
        arrearsAmount: 3500 * index,
        isTailPaymentCompleted: false,
        remark: `seed customer ${index}`,
      },
    })
    seededCustomers.push({ id: customer.id, index })
  }

  for (const { id, index } of seededCustomers) {
    const orderDate = orderDates[index - 1]
    const assignment = await prisma.secondSalesAssignment.create({
      data: {
        customerId: id,
        assignedById: firstSalesUser.id,
        secondSalesUserId: secondSalesUser.id,
        assignedAt: orderDate,
        status: AssignmentStatus.COMPLETED,
        remark: `seed-assignment-${index}`,
      },
    })

    await prisma.firstSalesOrder.create({
      data: {
        customerId: id,
        salesUserId: firstSalesUser.id,
        orderType: index === 1 ? FirstOrderType.DEPOSIT : index === 2 ? FirstOrderType.FULL : FirstOrderType.TAIL,
        isTimelyDeal: index !== 3,
        targetAmount: 10000 * index,
        contractAmount: 10000 * index,
        paymentAmount: 3000 * index,
        arrearsAmount: 7000 * index,
        paymentAccountId: paymentAccount.id,
        paymentAccountName: paymentAccount.accountName,
        paymentSerialNo: `SEED-FS-${index}`,
        paymentStatus: index === 2 ? 'PAID' : 'PARTIAL',
        financeReviewStatus: FinanceReviewStatus.APPROVED,
        financeReviewerId: (await prisma.user.findUniqueOrThrow({ where: { username: 'admin' }, select: { id: true } })).id,
        financeReviewedAt: orderDate,
        orderDate,
        remark: `seed first sales ${index}`,
      },
    })

    await prisma.secondSalesOrder.create({
      data: {
        customerId: id,
        secondSalesUserId: secondSalesUser.id,
        assignmentId: assignment.id,
        secondPaymentAmount: 2000 * index,
        includesHearing: index % 2 === 1,
        hearingCostAmount: index % 2 === 1 ? 500 : 0,
        performanceAmount: 1800 * index,
        paymentAccountId: paymentAccount.id,
        paymentAccountName: paymentAccount.accountName,
        paymentSerialNo: `SEED-SS-${index}`,
        financeReviewStatus: FinanceReviewStatus.APPROVED,
        financeReviewerId: (await prisma.user.findUniqueOrThrow({ where: { username: 'admin' }, select: { id: true } })).id,
        financeReviewedAt: orderDate,
        orderDate,
        remark: `seed second sales ${index}`,
      },
    })

    await prisma.legalCase.create({
      data: {
        customerId: id,
        legalUserId: legalUser.id,
        startDate: orderDate,
        progressStatus: '处理中',
        filingApproved: true,
        isCompleted: false,
        remark: `seed-case-${index}`,
      },
    })

    await prisma.thirdSalesOrder.create({
      data: {
        customerId: id,
        thirdSalesUserId: thirdSalesUser.id,
        sourceStage: 'LEGAL',
        productName: `增值服务${index}`,
        paymentAmount: 1500 * index,
        rawPerformanceAmount: 1500 * index,
        hearingCostAmount: 300,
        performanceAmount: 1200 * index,
        paymentAccountId: paymentAccount.id,
        paymentAccountName: paymentAccount.accountName,
        paymentSerialNo: `SEED-TS-${index}`,
        financeReviewStatus: FinanceReviewStatus.APPROVED,
        financeReviewerId: (await prisma.user.findUniqueOrThrow({ where: { username: 'admin' }, select: { id: true } })).id,
        financeReviewedAt: orderDate,
        orderDate,
        remark: `seed third sales ${index}`,
      },
    })
  }

  if (hrDepartment) {
    await prisma.department.update({
      where: { id: hrDepartment.id },
      data: { hrUserId: hrUser.id },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
