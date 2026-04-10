import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type SalesOrderStage = 'FIRST' | 'SECOND' | 'THIRD'

@Injectable()
export class PaymentSerialValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureUnique(paymentSerialNo: string, current?: { stage: SalesOrderStage; id: number }) {
    const normalized = paymentSerialNo.trim()
    if (!normalized) {
      return
    }

    const [firstOrder, secondOrder, thirdOrder] = await Promise.all([
      this.prisma.firstSalesOrder.findFirst({ where: { paymentSerialNo: normalized }, select: { id: true } }),
      this.prisma.secondSalesOrder.findFirst({ where: { paymentSerialNo: normalized }, select: { id: true } }),
      this.prisma.thirdSalesOrder.findFirst({ where: { paymentSerialNo: normalized }, select: { id: true } }),
    ])

    const duplicated = [
      firstOrder ? { stage: 'FIRST' as const, id: firstOrder.id } : null,
      secondOrder ? { stage: 'SECOND' as const, id: secondOrder.id } : null,
      thirdOrder ? { stage: 'THIRD' as const, id: thirdOrder.id } : null,
    ].find((item) => item && (!current || item.stage !== current.stage || item.id !== current.id))

    if (duplicated) {
      throw new BadRequestException('付款单号已存在')
    }
  }
}
