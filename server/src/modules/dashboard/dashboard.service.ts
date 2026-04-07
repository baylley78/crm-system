import { CustomerStatus } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [firstSalesOrders, secondSalesOrders, thirdSalesOrders, pendingTailPaymentCount, pendingSecondSalesCount, legalProcessingCount, pendingThirdSalesCount] = await Promise.all([
      this.prisma.firstSalesOrder.aggregate({
        _sum: { paymentAmount: true },
        where: { orderDate: { gte: today } },
      }),
      this.prisma.secondSalesOrder.aggregate({
        _sum: { secondPaymentAmount: true },
        where: { orderDate: { gte: today } },
      }),
      this.prisma.thirdSalesOrder.aggregate({
        _sum: { paymentAmount: true },
        where: { orderDate: { gte: today } },
      }),
      this.prisma.customer.count({ where: { currentStatus: CustomerStatus.PENDING_TAIL_PAYMENT } }),
      this.prisma.customer.count({ where: { currentStatus: CustomerStatus.PENDING_SECOND_SALES_ASSIGNMENT } }),
      this.prisma.customer.count({ where: { currentStatus: CustomerStatus.LEGAL_PROCESSING } }),
      this.prisma.customer.count({ where: { currentStatus: CustomerStatus.PENDING_THIRD_SALES } }),
    ])

    const arrears = await this.prisma.customer.aggregate({
      _sum: { arrearsAmount: true },
    })

    return {
      stats: [
        { label: '今日一销回款', value: Number(firstSalesOrders._sum.paymentAmount ?? 0), type: 'primary' },
        { label: '今日二销回款', value: Number(secondSalesOrders._sum.secondPaymentAmount ?? 0), type: 'success' },
        { label: '今日三销回款', value: Number(thirdSalesOrders._sum.paymentAmount ?? 0), type: 'warning' },
        { label: '总欠款金额', value: Number(arrears._sum.arrearsAmount ?? 0), type: 'danger' },
      ],
      todoCards: [
        { title: '待补尾款', count: pendingTailPaymentCount },
        { title: '待分配二销', count: pendingSecondSalesCount },
        { title: '法务处理中', count: legalProcessingCount },
        { title: '待三销跟进', count: pendingThirdSalesCount },
      ],
    }
  }
}
