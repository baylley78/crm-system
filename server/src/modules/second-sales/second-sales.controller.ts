import { Body, Controller, Get, Patch, Post, UploadedFiles, UseGuards, UseInterceptors, BadRequestException, ForbiddenException, NotFoundException, Param, Query } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { DashboardService } from '../dashboard/dashboard.service'
import { PrismaService } from '../../prisma/prisma.service'
import { CustomersService } from '../customers/customers.service'
import { FilesService } from '../files/files.service'
import { SearchCustomerByPhoneDto, AssignSecondSalesDto, CreateSecondSalesOrderDto, TransferToMediationDto } from './dto/second-sales.dto'
import { CustomerStatus } from '@prisma/client'
import { SecondSalesService } from './second-sales.service'
import { FinanceReviewActionDto } from '../first-sales/dto/finance-review-action.dto'
import { BatchFinanceReviewDto } from '../first-sales/dto/batch-finance-review.dto'
import { QueryOrderListDto } from '../../common/dto/query-order-list.dto'

const SECOND_SALES_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const SECOND_SALES_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
const createSecondSalesUploadOptions = () => ({
  storage: diskStorage({
    destination: 'uploads',
    filename: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase()
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      callback(null, `${file.fieldname}-${uniqueSuffix}${extension}`)
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 22,
  },
  fileFilter: (_req: unknown, file: { mimetype: string; originalname: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase()
    if (!SECOND_SALES_UPLOAD_MIME_TYPES.includes(file.mimetype) || !SECOND_SALES_UPLOAD_EXTENSIONS.includes(extension)) {
      callback(new BadRequestException('上传文件类型不支持') as unknown as Error, false)
      return
    }
    callback(null, true)
  },
})

const SECOND_SALES_ROLE_CODES = ['SUPER_ADMIN', 'SECOND_SALES_MANAGER', 'SECOND_SALES_SUPERVISOR', 'SECOND_SALES']
const MEDIATION_OWNER_ROLE_CODES = ['SUPER_ADMIN', 'LEGAL_MANAGER', 'LEGAL', 'SECOND_SALES_MANAGER', 'SECOND_SALES_SUPERVISOR', 'SECOND_SALES', 'AFTER_SALES_MANAGER', 'AFTER_SALES', 'MEDIATION_SPECIALIST']

@Controller('second-sales')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('secondSales.view')
export class SecondSalesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly dashboardService: DashboardService,
    private readonly secondSalesService: SecondSalesService,
    private readonly filesService: FilesService,
  ) {}

  @Get('assignments')
  @RequirePermission('secondSales.assignment.view')
  async getAssignments(@CurrentUser() currentUser: AuthenticatedUser) {
    const customers = await this.prisma.customer.findMany({
      where: {
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
        currentStatus: {
          in: [
            CustomerStatus.PENDING_SECOND_SALES_ASSIGNMENT,
            CustomerStatus.SECOND_SALES_FOLLOWING,
            CustomerStatus.PENDING_LEGAL,
            CustomerStatus.PENDING_MEDIATION,
            CustomerStatus.MEDIATION_PROCESSING,
            CustomerStatus.MEDIATION_COMPLETED,
            CustomerStatus.PENDING_THIRD_SALES,
          ],
        },
      },
      include: {
        firstSalesUser: true,
        secondSalesUser: true,
        firstSalesOrders: {
          select: {
            paymentScreenshotUrl: true,
            chatRecordUrl: true,
            evidenceImageUrls: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return customers.map((customer) => {
      const firstSalesEvidence = customer.firstSalesOrders.flatMap((item) => {
        const result: Array<{ label: string; url: string; source: 'FIRST_SALES' }> = []
        if (item.paymentScreenshotUrl) {
          const accessUrl = this.filesService.toAccessUrl(item.paymentScreenshotUrl)
          if (accessUrl) {
            result.push({ label: '一销付款截图', url: accessUrl, source: 'FIRST_SALES' })
          }
        }
        if (item.chatRecordUrl) {
          const accessUrl = this.filesService.toAccessUrl(item.chatRecordUrl)
          if (accessUrl) {
            result.push({ label: '一销聊天记录', url: accessUrl, source: 'FIRST_SALES' })
          }
        }
        for (const url of this.filesService.toAccessUrls(this.filesService.parseJsonFileUrls(item.evidenceImageUrls))) {
          result.push({ label: '一销证据', url, source: 'FIRST_SALES' })
        }
        return result
      })

      return {
        id: customer.id,
        customerNo: customer.customerNo,
        name: customer.name,
        phone: customer.phone,
        currentOwnerId: customer.currentOwnerId ?? undefined,
        firstSalesUserId: customer.firstSalesUserId ?? undefined,
        secondSalesUserId: customer.secondSalesUserId ?? undefined,
        legalUserId: customer.legalUserId ?? undefined,
        thirdSalesUserId: customer.thirdSalesUserId ?? undefined,
        firstSalesUserName: customer.firstSalesUser?.realName,
        secondSalesUserName: customer.secondSalesUser?.realName,
        firstPaymentAmount: Number(customer.firstPaymentAmount),
        arrearsAmount: Number(customer.arrearsAmount),
        remark: customer.remark,
        firstSalesRemark: customer.remark,
        firstSalesEvidence,
        currentStatus: customer.currentStatus,
      }
    })
  }

  @Get('users')
  @RequirePermission('secondSales.users.view')
  async getUsers() {
    const users = await this.prisma.user.findMany({ include: { role: true }, orderBy: { id: 'asc' } })
    return users
      .filter((user) => SECOND_SALES_ROLE_CODES.includes(user.role.code))
      .map((user) => ({ id: user.id, realName: user.realName, roleName: user.role.name }))
  }

  @Get('orders')
  async getOrders(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryOrderListDto) {
    return this.secondSalesService.findOrders(currentUser, query)
  }

  @Post('search')
  async search(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: SearchCustomerByPhoneDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        phone: dto.phone,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
      include: { firstSalesUser: true, secondSalesUser: true },
    })

    if (!customer) {
      return null
    }

    return {
      id: customer.id,
      customerNo: customer.customerNo,
      name: customer.name,
      phone: customer.phone,
      currentOwnerId: customer.currentOwnerId ?? undefined,
      firstSalesUserId: customer.firstSalesUserId ?? undefined,
      secondSalesUserId: customer.secondSalesUserId ?? undefined,
      legalUserId: customer.legalUserId ?? undefined,
      thirdSalesUserId: customer.thirdSalesUserId ?? undefined,
      currentStatus: customer.currentStatus,
      firstSalesUserName: customer.firstSalesUser?.realName,
      secondSalesUserName: customer.secondSalesUser?.realName,
      caseType: customer.caseType,
      source: customer.source,
      intentionLevel: customer.intentionLevel,
      firstPaymentAmount: Number(customer.firstPaymentAmount),
      secondPaymentAmount: Number(customer.secondPaymentAmount),
      totalPaymentAmount: Number(customer.totalPaymentAmount),
      arrearsAmount: Number(customer.arrearsAmount),
    }
  }

  @Post('assignments')
  @RequirePermission('secondSales.assign')
  async assign(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: AssignSecondSalesDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        ...(await this.customersService.buildCustomerVisibilityWhere(currentUser)),
      },
      select: { id: true },
    })

    if (!customer) {
      const exists = await this.prisma.customer.findUnique({ where: { id: dto.customerId }, select: { id: true } })
      if (exists) {
        throw new ForbiddenException('无权访问该客户')
      }
      throw new NotFoundException('客户不存在')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.secondSalesAssignment.create({
        data: {
          customerId: dto.customerId,
          assignedById: currentUser.id,
          secondSalesUserId: dto.secondSalesUserId,
          remark: dto.remark,
        },
      })

      await tx.customer.update({
        where: { id: dto.customerId },
        data: {
          secondSalesUserId: dto.secondSalesUserId,
          currentOwnerId: dto.secondSalesUserId,
          currentStatus: CustomerStatus.SECOND_SALES_FOLLOWING,
        },
      })
    })

    return { success: true }
  }

  @Post('transfer-to-mediation')
  @RequirePermission('secondSales.transfer')
  async transferToMediation(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: TransferToMediationDto) {
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
      throw new NotFoundException('客户不存在')
    }

    if (
      customer.currentStatus === CustomerStatus.MEDIATION_PROCESSING ||
      customer.currentStatus === CustomerStatus.MEDIATION_COMPLETED
    ) {
      throw new BadRequestException('客户已在调解流程中')
    }

    const mediationOwner = await this.prisma.user.findFirst({
      where: {
        role: {
          code: {
            in: MEDIATION_OWNER_ROLE_CODES,
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    if (!mediationOwner) {
      throw new BadRequestException('暂无可分配的调解负责人')
    }

    await this.prisma.mediationCase.create({
      data: {
        customerId: customer.id,
        ownerId: mediationOwner.id,
        progressStatus: '调解处理中',
        remark: '二销未成交，自动转入调解中心',
      },
    })

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        currentOwnerId: mediationOwner.id,
        currentStatus: CustomerStatus.PENDING_MEDIATION,
      },
    })

    return { success: true }
  }

  @Post('orders')
  @RequirePermission('secondSales.create')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'paymentScreenshot', maxCount: 1 },
        { name: 'chatRecordFile', maxCount: 1 },
        { name: 'evidenceFiles', maxCount: 20 },
      ],
      createSecondSalesUploadOptions(),
    ),
  )
  async createOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateSecondSalesOrderDto,
    @UploadedFiles()
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      chatRecordFile?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string; originalname?: string }>
    },
  ) {
    return this.secondSalesService.createOrder(currentUser, dto, files)
  }

  @Patch('orders/:id')
  @RequirePermission('secondSales.edit')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'paymentScreenshot', maxCount: 1 },
        { name: 'chatRecordFile', maxCount: 1 },
        { name: 'evidenceFiles', maxCount: 20 },
      ],
      createSecondSalesUploadOptions(),
    ),
  )
  async updateOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateSecondSalesOrderDto,
    @UploadedFiles()
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      chatRecordFile?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string; originalname?: string }>
    },
  ) {
    return this.secondSalesService.updateOrder(currentUser, Number(id), dto, files)
  }

  @Post('orders/:id/finance-review')
  @RequirePermission('secondSales.review.single')
  reviewOrder(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: FinanceReviewActionDto) {
    return this.secondSalesService.reviewOrder(currentUser, Number(id), dto)
  }

  @Post('orders/finance-review/batch')
  @RequirePermission('secondSales.review.batch')
  batchReviewOrders(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: BatchFinanceReviewDto) {
    return this.secondSalesService.batchReviewOrders(currentUser, dto)
  }
}
