import { Injectable, NotFoundException } from '@nestjs/common'
import { SavePaymentAccountDto } from './dto/save-payment-account.dto'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PaymentAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const accounts = await this.prisma.paymentAccount.findMany({
      orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
    })

    return accounts.map((item) => ({
      id: item.id,
      accountName: item.accountName,
      bankName: item.bankName,
      accountNo: item.accountNo,
      remark: item.remark,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
  }

  async findEnabledOptions() {
    const accounts = await this.prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })

    return accounts.map((item) => ({
      id: item.id,
      accountName: item.accountName,
      bankName: item.bankName,
      accountNo: this.maskAccountNo(item.accountNo),
    }))
  }

  async create(dto: SavePaymentAccountDto) {
    const account = await this.prisma.paymentAccount.create({
      data: {
        accountName: dto.accountName.trim(),
        bankName: dto.bankName?.trim(),
        accountNo: dto.accountNo.trim(),
        remark: dto.remark?.trim(),
        isActive: dto.isActive ?? true,
      },
    })

    return account
  }

  async update(id: number, dto: SavePaymentAccountDto) {
    await this.ensureExists(id)
    return this.prisma.paymentAccount.update({
      where: { id },
      data: {
        accountName: dto.accountName.trim(),
        bankName: dto.bankName?.trim(),
        accountNo: dto.accountNo.trim(),
        remark: dto.remark?.trim(),
        isActive: dto.isActive ?? true,
      },
    })
  }

  async ensureAvailable(id: number) {
    const account = await this.prisma.paymentAccount.findFirst({
      where: { id, isActive: true },
    })

    if (!account) {
      throw new NotFoundException('收款账户不存在或已停用')
    }

    return account
  }

  private async ensureExists(id: number) {
    const account = await this.prisma.paymentAccount.findUnique({ where: { id } })
    if (!account) {
      throw new NotFoundException('收款账户不存在')
    }
    return account
  }

  private maskAccountNo(accountNo: string) {
    if (accountNo.length <= 8) {
      return `${accountNo.slice(0, 2)}****${accountNo.slice(-2)}`
    }

    return `${accountNo.slice(0, 4)} **** **** ${accountNo.slice(-4)}`
  }
}
