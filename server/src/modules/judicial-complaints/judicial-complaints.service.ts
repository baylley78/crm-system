import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { JudicialComplaintHandlingStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'
import { CreateJudicialComplaintDto } from './dto/create-judicial-complaint.dto'
import { QueryJudicialComplaintsDto } from './dto/query-judicial-complaints.dto'
import { SearchJudicialComplaintCustomerDto } from './dto/search-judicial-complaint-customer.dto'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

@Injectable()
export class JudicialComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async findCases(currentUser: AuthenticatedUser, query: QueryJudicialComplaintsDto) {
    const page = query.page ?? DEFAULT_PAGE
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
    const skip = (page - 1) * pageSize
    const visibilityWhere = await this.customersService.buildCustomerVisibilityWhere(currentUser)
    const where = {
      OR: [{ customer: visibilityWhere }, { customerId: null }],
      ...(query.handlingStatus ? { handlingStatus: query.handlingStatus as JudicialComplaintHandlingStatus } : {}),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.judicialComplaintCase.findMany({
        where,
        include: {
          customer: true,
          submittedBy: true,
          handledBy: true,
        },
        orderBy: [{ complaintTime: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.judicialComplaintCase.count({ where }),
    ])

    return {
      items: items.map((item) => this.mapCase(item)),
      total,
      page,
      pageSize,
    }
  }

  async findCaseDetail(currentUser: AuthenticatedUser, id: number) {
    const item = await this.prisma.judicialComplaintCase.findUnique({
      where: { id },
      include: {
        customer: true,
        submittedBy: true,
        handledBy: true,
      },
    })

    if (!item) {
      throw new NotFoundException('司法投诉不存在')
    }

    if (item.customerId) {
      const visibleCustomer = await this.prisma.customer.findFirst({
        where: {
          id: item.customerId,
          ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
        },
        select: { id: true },
      })
      if (!visibleCustomer) {
        throw new ForbiddenException('无权访问该司法投诉')
      }
    }

    return this.mapCase(item, true)
  }

  async searchCustomer(currentUser: AuthenticatedUser, dto: SearchJudicialComplaintCustomerDto) {
    const trimmedPhone = dto.phone.trim()
    const customer = await this.prisma.customer.findFirst({
      where: {
        phone: trimmedPhone,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
      include: {
        firstSalesUser: {
          include: {
            departmentInfo: {
              include: {
                parent: true,
              },
            },
          },
        },
        secondSalesUser: true,
        legalUser: true,
      },
    })

    if (!customer) {
      const exists = await this.prisma.customer.findUnique({ where: { phone: trimmedPhone }, select: { id: true } })
      if (exists) {
        throw new ForbiddenException('无权访问该客户')
      }
      return null
    }

    return {
      id: customer.id,
      customerNo: customer.customerNo,
      name: customer.name,
      phone: customer.phone,
      currentStatus: customer.currentStatus,
      source: customer.source,
      caseType: customer.caseType,
      intentionLevel: customer.intentionLevel,
      departmentName: customer.firstSalesUser?.departmentInfo?.name || undefined,
      firstSalesTeamName: customer.firstSalesUser?.departmentInfo?.parent?.name || customer.firstSalesUser?.departmentInfo?.name || undefined,
      firstSalesUserName: customer.firstSalesUser?.realName,
      secondSalesUserName: customer.secondSalesUser?.realName,
      legalUserName: customer.legalUser?.realName,
      firstPaymentAmount: Number(customer.firstPaymentAmount ?? 0),
      secondPaymentAmount: Number(customer.secondPaymentAmount ?? 0),
      totalPaymentAmount: Number(customer.totalPaymentAmount ?? 0),
      arrearsAmount: Number(customer.arrearsAmount ?? 0),
    }
  }

  async createCase(currentUser: AuthenticatedUser, dto: CreateJudicialComplaintDto) {
    const visibilityWhere = await this.customersService.buildCustomerVisibilityWhere(currentUser)
    const trimmedPhone = dto.phone.trim()
    const trimmedName = dto.customerName.trim()

    let customer = dto.customerId
      ? await this.prisma.customer.findFirst({
          where: { id: dto.customerId, ...visibilityWhere },
        })
      : null

    if (!customer) {
      customer = await this.prisma.customer.findFirst({
        where: { phone: trimmedPhone, ...visibilityWhere },
      })

      if (!customer) {
        const exists = await this.prisma.customer.findUnique({ where: { phone: trimmedPhone }, select: { id: true } })
        if (exists) {
          throw new ForbiddenException('无权访问该客户')
        }
      }
    }

    const created = await this.prisma.judicialComplaintCase.create({
      data: {
        customerId: customer?.id,
        submittedById: currentUser.id,
        complaintSubject: dto.complaintSubject.trim(),
        teamName: dto.teamName?.trim(),
        departmentName: dto.departmentName?.trim(),
        complaintTime: new Date(dto.complaintTime),
        customerName: trimmedName,
        phone: trimmedPhone,
        relationToCustomer: dto.relationToCustomer?.trim(),
        firstSignTime: dto.firstSignTime ? new Date(dto.firstSignTime) : undefined,
        secondSignTime: dto.secondSignTime ? new Date(dto.secondSignTime) : undefined,
        firstDealAmount: dto.firstDealAmount ?? 0,
        secondDealAmount: dto.secondDealAmount ?? 0,
        firstSalesName: dto.firstSalesName?.trim(),
        secondSalesName: dto.secondSalesName?.trim(),
        legalAssistantName: dto.legalAssistantName?.trim(),
        summary: dto.summary?.trim(),
        complaintReason: dto.complaintReason.trim(),
        progress: dto.progress?.trim(),
        refundAmount: dto.refundAmount ?? 0,
        intervenedBeforeComplaint: dto.intervenedBeforeComplaint,
        suddenRefundRequest: dto.suddenRefundRequest,
        thirdPartyGuidance: dto.thirdPartyGuidance,
        shouldHandle: dto.shouldHandle,
        handlingStatus: dto.shouldHandle ? JudicialComplaintHandlingStatus.PENDING : JudicialComplaintHandlingStatus.IGNORED,
      },
      include: {
        customer: true,
        submittedBy: true,
        handledBy: true,
      },
    })

    return this.mapCase(created, true)
  }

  private mapHandlingStatus(status: JudicialComplaintHandlingStatus) {
    const labels: Record<JudicialComplaintHandlingStatus, string> = {
      PENDING: '待处理',
      PROCESSING: '处理中',
      HANDLED: '已处理',
      IGNORED: '无需处理',
    }

    return labels[status]
  }

  private mapCase(item: any, includeCustomerDetail = false) {
    return {
      id: item.id,
      customerId: item.customerId ?? undefined,
      complaintSubject: item.complaintSubject,
      teamName: item.teamName,
      departmentName: item.departmentName,
      complaintTime: item.complaintTime,
      customerName: item.customerName,
      phone: item.phone,
      relationToCustomer: item.relationToCustomer,
      firstSignTime: item.firstSignTime,
      secondSignTime: item.secondSignTime,
      firstDealAmount: Number(item.firstDealAmount ?? 0),
      secondDealAmount: Number(item.secondDealAmount ?? 0),
      firstSalesName: item.firstSalesName,
      secondSalesName: item.secondSalesName,
      legalAssistantName: item.legalAssistantName,
      summary: item.summary,
      complaintReason: item.complaintReason,
      progress: item.progress,
      refundAmount: Number(item.refundAmount ?? 0),
      intervenedBeforeComplaint: item.intervenedBeforeComplaint,
      suddenRefundRequest: item.suddenRefundRequest,
      thirdPartyGuidance: item.thirdPartyGuidance,
      shouldHandle: item.shouldHandle,
      handlingStatus: item.handlingStatus,
      handlingStatusLabel: this.mapHandlingStatus(item.handlingStatus),
      handledAt: item.handledAt,
      submittedById: item.submittedById,
      submittedByName: item.submittedBy?.realName,
      handledById: item.handledById ?? undefined,
      handledByName: item.handledBy?.realName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      customer: includeCustomerDetail && item.customer
        ? {
            id: item.customer.id,
            customerNo: item.customer.customerNo,
            name: item.customer.name,
            phone: item.customer.phone,
            source: item.customer.source,
            caseType: item.customer.caseType,
            intentionLevel: item.customer.intentionLevel,
          }
        : undefined,
    }
  }
}
