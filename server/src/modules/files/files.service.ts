import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { existsSync } from 'fs'
import { join, normalize } from 'path'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from '../customers/customers.service'

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  toAccessUrl(fileUrl?: string | null) {
    const filename = this.extractFilename(fileUrl)
    return filename ? `/files/${encodeURIComponent(filename)}` : fileUrl ?? undefined
  }

  toAccessUrls(fileUrls: string[]) {
    return fileUrls.map((url) => this.toAccessUrl(url) ?? url)
  }

  parseJsonFileUrls(value?: string | null) {
    if (!value) {
      return []
    }

    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  }

  async getAuthorizedFile(currentUser: AuthenticatedUser, filename: string) {
    if (!filename || filename.includes('/') || filename.includes('\\')) {
      throw new NotFoundException('文件不存在')
    }

    const normalizedFilename = normalize(filename)
    if (normalizedFilename !== filename || normalizedFilename.includes('..')) {
      throw new NotFoundException('文件不存在')
    }

    const storedPath = `/uploads/${filename}`
    const customerId = await this.findCustomerIdByFile(storedPath)
    if (!customerId) {
      throw new NotFoundException('文件不存在')
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
      select: { id: true },
    })

    if (!customer) {
      throw new ForbiddenException('无权访问该文件')
    }

    const absolutePath = join(process.cwd(), 'uploads', filename)
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('文件不存在')
    }

    return { absolutePath }
  }

  private extractFilename(fileUrl?: string | null) {
    if (!fileUrl?.startsWith('/uploads/')) {
      return undefined
    }

    return fileUrl.slice('/uploads/'.length)
  }

  private async findCustomerIdByFile(fileUrl: string) {
    const [firstSalesOrder, customer, secondSalesOrder, thirdSalesOrder, mediationCase, contractArchive] = await Promise.all([
      this.prisma.firstSalesOrder.findFirst({
        where: {
          OR: [{ paymentScreenshotUrl: fileUrl }, { chatRecordUrl: fileUrl }, { evidenceImageUrls: { contains: fileUrl } }],
        },
        select: { customerId: true },
      }),
      this.prisma.customer.findFirst({
        where: { firstSalesChatRecordUrl: fileUrl },
        select: { id: true },
      }),
      this.prisma.secondSalesOrder.findFirst({
        where: {
          OR: [{ paymentScreenshotUrl: fileUrl }, { chatRecordUrl: fileUrl }, { evidenceFileUrls: { contains: fileUrl } }],
        },
        select: { customerId: true },
      }),
      this.prisma.thirdSalesOrder.findFirst({
        where: {
          OR: [{ paymentScreenshotUrl: fileUrl }, { evidenceFileUrls: { contains: fileUrl } }],
        },
        select: { customerId: true },
      }),
      this.prisma.mediationCase.findFirst({
        where: { evidenceFileUrls: { contains: fileUrl } },
        select: { customerId: true },
      }),
      this.prisma.contractArchive.findFirst({
        where: { fileUrl },
        select: { customerId: true },
      }),
    ])

    return (
      firstSalesOrder?.customerId ??
      customer?.id ??
      secondSalesOrder?.customerId ??
      thirdSalesOrder?.customerId ??
      mediationCase?.customerId ??
      contractArchive?.customerId
    )
  }
}
