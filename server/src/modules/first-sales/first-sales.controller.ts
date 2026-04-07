import { Body, Controller, Get, Param, Patch, Post, UploadedFiles, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { FirstSalesService } from './first-sales.service'
import { CreateFirstSalesOrderDto } from './dto/create-first-sales-order.dto'
import { CreateFirstSalesTailOrderDto } from './dto/create-first-sales-tail-order.dto'
import { FinanceReviewActionDto } from './dto/finance-review-action.dto'
import { BatchFinanceReviewDto } from './dto/batch-finance-review.dto'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DOCUMENT_MIME_TYPES = ['application/pdf']
const UPLOAD_MIME_TYPES = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]
const UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
const createUploadOptions = (allowedMimeTypes: string[]) => ({
  storage: diskStorage({
    destination: 'uploads',
    filename: (_, file, callback) => {
      const extension = extname(file.originalname).toLowerCase()
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      callback(null, `${file.fieldname}-${uniqueSuffix}${extension}`)
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 22,
  },
  fileFilter: (_: any, file: { mimetype: string; originalname: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase()
    if (!allowedMimeTypes.includes(file.mimetype) || !UPLOAD_EXTENSIONS.includes(extension)) {
      callback(new BadRequestException('上传文件类型不支持') as unknown as Error, false)
      return
    }
    callback(null, true)
  },
})

@Controller('first-sales')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('firstSales.view')
export class FirstSalesController {
  constructor(private readonly firstSalesService: FirstSalesService) {}

  @Post('orders')
  @RequirePermission('firstSales.create')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'paymentScreenshot', maxCount: 1 },
        { name: 'chatRecordFile', maxCount: 1 },
        { name: 'evidenceImages', maxCount: 20 },
      ],
      createUploadOptions(UPLOAD_MIME_TYPES),
    ),
  )
  createOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateFirstSalesOrderDto,
    @UploadedFiles()
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      chatRecordFile?: Array<{ filename: string }>
      evidenceImages?: Array<{ filename: string }>
    },
  ) {
    return this.firstSalesService.createOrder(currentUser, dto, {
      paymentScreenshot: files.paymentScreenshot?.[0],
      chatRecordFile: files.chatRecordFile?.[0],
      evidenceImages: files.evidenceImages || [],
    })
  }

  @Post('customers/:customerId/tail-order')
  @RequirePermission('firstSales.tail')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'paymentScreenshot', maxCount: 1 },
        { name: 'chatRecordFile', maxCount: 1 },
        { name: 'evidenceImages', maxCount: 20 },
      ],
      createUploadOptions(UPLOAD_MIME_TYPES),
    ),
  )
  createTailOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: CreateFirstSalesTailOrderDto,
    @UploadedFiles()
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      chatRecordFile?: Array<{ filename: string }>
      evidenceImages?: Array<{ filename: string }>
    },
  ) {
    return this.firstSalesService.createTailOrder(currentUser, Number(customerId), dto, {
      paymentScreenshot: files.paymentScreenshot?.[0],
      chatRecordFile: files.chatRecordFile?.[0],
      evidenceImages: files.evidenceImages || [],
    })
  }

  @Patch('orders/:id')
  @RequirePermission('firstSales.edit')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'paymentScreenshot', maxCount: 1 },
        { name: 'chatRecordFile', maxCount: 1 },
        { name: 'evidenceImages', maxCount: 20 },
      ],
      createUploadOptions(UPLOAD_MIME_TYPES),
    ),
  )
  updateOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateFirstSalesOrderDto,
    @UploadedFiles()
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      chatRecordFile?: Array<{ filename: string }>
      evidenceImages?: Array<{ filename: string }>
    },
  ) {
    return this.firstSalesService.updateOrder(currentUser, Number(id), dto, {
      paymentScreenshot: files.paymentScreenshot?.[0],
      chatRecordFile: files.chatRecordFile?.[0],
      evidenceImages: files.evidenceImages || [],
    })
  }

  @Get('orders')
  findOrders(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.firstSalesService.findOrders(currentUser)
  }

  @Get('users')
  findUsers() {
    return this.firstSalesService.findSalesUsers()
  }

  @Post('orders/:id/finance-review')
  @RequirePermission('firstSales.review.single')
  reviewOrder(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: FinanceReviewActionDto) {
    return this.firstSalesService.reviewOrder(currentUser, Number(id), dto)
  }

  @Post('orders/finance-review/batch')
  @RequirePermission('firstSales.review.batch')
  batchReviewOrders(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: BatchFinanceReviewDto) {
    return this.firstSalesService.batchReviewOrders(currentUser, dto)
  }
}
