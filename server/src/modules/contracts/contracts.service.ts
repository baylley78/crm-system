import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ContractSalesStage } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { FilesService } from '../files/files.service'
import { ContractSalesStageDto, CreateContractArchiveDto } from './dto/create-contract-archive.dto'

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly filesService: FilesService,
  ) {}

  async findAll(currentUser: AuthenticatedUser) {
    const items = await this.prisma.contractArchive.findMany({
      where: {
        customer: await this.customersService.buildCustomerVisibilityWhere(currentUser),
      },
      include: {
        customer: true,
        contractSpecialist: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return items.map((item) => ({
      id: item.id,
      contractNo: item.contractNo,
      customerId: item.customerId,
      customerNo: item.customer.customerNo,
      customerName: item.customer.name,
      customerPhone: item.customer.phone,
      currentOwnerId: item.customer.currentOwnerId ?? undefined,
      firstSalesUserId: item.customer.firstSalesUserId ?? undefined,
      secondSalesUserId: item.customer.secondSalesUserId ?? undefined,
      legalUserId: item.customer.legalUserId ?? undefined,
      thirdSalesUserId: item.customer.thirdSalesUserId ?? undefined,
      salesStage: item.salesStage,
      relatedOrderId: item.relatedOrderId,
      amount: Number(item.amount),
      signDate: item.signDate,
      fileUrl: this.filesService.toAccessUrl(item.fileUrl),
      contractSpecialistId: item.contractSpecialistId,
      contractSpecialistName: item.contractSpecialist.realName,
      remark: item.remark,
      createdAt: item.createdAt,
    }))
  }

  async findCustomers(currentUser: AuthenticatedUser) {
    const customers = await this.prisma.customer.findMany({
      where: await this.customersService.buildCustomerVisibilityWhere(currentUser),
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return customers.map((item) => ({
      id: item.id,
      customerNo: item.customerNo,
      name: item.name,
      phone: item.phone,
      currentOwnerId: item.currentOwnerId ?? undefined,
      firstSalesUserId: item.firstSalesUserId ?? undefined,
      secondSalesUserId: item.secondSalesUserId ?? undefined,
      legalUserId: item.legalUserId ?? undefined,
      thirdSalesUserId: item.thirdSalesUserId ?? undefined,
      currentStatus: item.currentStatus,
    }))
  }

  async findUsers() {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { id: 'asc' },
    })

    return users.map((user) => ({
      id: user.id,
      realName: user.realName,
      roleName: user.role.name,
    }))
  }

  async findCustomerOrders(currentUser: AuthenticatedUser, customerId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
    })
    if (!customer) {
      const exists = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })
      if (exists) {
        throw new ForbiddenException('无权访问该客户')
      }
      throw new NotFoundException('客户不存在')
    }

    const [firstOrders, secondOrders, thirdOrders] = await Promise.all([
      this.prisma.firstSalesOrder.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.secondSalesOrder.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.thirdSalesOrder.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),
    ])

    return [
      ...firstOrders.map((item, index) => ({
        id: item.id,
        salesStage: 'FIRST',
        label: `一销第${index + 1}次 · 合同金额 ${Number(item.contractAmount)} · ${item.createdAt.toISOString().slice(0, 10)}`,
      })),
      ...secondOrders.map((item, index) => ({
        id: item.id,
        salesStage: 'SECOND',
        label: `二销第${index + 1}次 · 付款金额 ${Number(item.secondPaymentAmount)} · ${item.createdAt.toISOString().slice(0, 10)}`,
      })),
      ...thirdOrders.map((item, index) => ({
        id: item.id,
        salesStage: 'THIRD',
        label: `三销第${index + 1}次 · 回款 ${Number(item.paymentAmount)} · ${item.productName} · ${item.createdAt.toISOString().slice(0, 10)}`,
      })),
    ]
  }

  async create(currentUser: AuthenticatedUser, dto: CreateContractArchiveDto, fileUrl?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
    })
    if (!customer) {
      const exists = await this.prisma.customer.findUnique({ where: { id: dto.customerId }, select: { id: true } })
      if (exists) {
        throw new ForbiddenException('无权访问该客户')
      }
      throw new NotFoundException('关联客户不存在')
    }

    const specialist = await this.prisma.user.findUnique({ where: { id: dto.contractSpecialistId } })
    if (!specialist) {
      throw new NotFoundException('合同专员不存在')
    }

    await this.ensureRelatedOrderExists(dto)

    const item = await this.prisma.contractArchive.create({
      data: {
        contractNo: dto.contractNo,
        customerId: dto.customerId,
        salesStage: dto.salesStage as ContractSalesStage,
        relatedOrderId: dto.relatedOrderId,
        amount: dto.amount,
        signDate: new Date(dto.signDate),
        fileUrl,
        contractSpecialistId: dto.contractSpecialistId,
        remark: dto.remark,
      },
      include: {
        customer: true,
        contractSpecialist: true,
      },
    })

    return {
      id: item.id,
      contractNo: item.contractNo,
      customerId: item.customerId,
      customerNo: item.customer.customerNo,
      customerName: item.customer.name,
      customerPhone: item.customer.phone,
      salesStage: item.salesStage,
      relatedOrderId: item.relatedOrderId,
      amount: Number(item.amount),
      signDate: item.signDate,
      fileUrl: this.filesService.toAccessUrl(item.fileUrl),
      contractSpecialistId: item.contractSpecialistId,
      contractSpecialistName: item.contractSpecialist.realName,
      remark: item.remark,
      createdAt: item.createdAt,
    }
  }

  private async ensureRelatedOrderExists(dto: CreateContractArchiveDto) {
    if (dto.salesStage === ContractSalesStageDto.FIRST) {
      const order = await this.prisma.firstSalesOrder.findFirst({ where: { id: dto.relatedOrderId, customerId: dto.customerId } })
      if (!order) {
        throw new NotFoundException('关联一销记录不存在')
      }
      return
    }

    if (dto.salesStage === ContractSalesStageDto.SECOND) {
      const order = await this.prisma.secondSalesOrder.findFirst({ where: { id: dto.relatedOrderId, customerId: dto.customerId } })
      if (!order) {
        throw new NotFoundException('关联二销记录不存在')
      }
      return
    }

    const order = await this.prisma.thirdSalesOrder.findFirst({ where: { id: dto.relatedOrderId, customerId: dto.customerId } })
    if (!order) {
      throw new NotFoundException('关联三销记录不存在')
    }
  }
}
