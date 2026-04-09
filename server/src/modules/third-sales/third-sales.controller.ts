import { Body, Controller, Get, Patch, Post, UploadedFiles, UseGuards, UseInterceptors, Param, BadRequestException, Query, Delete } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { ThirdSalesService } from './third-sales.service'
import { CreateThirdSalesOrderDto, SearchThirdSalesCustomerDto } from './dto/third-sales.dto'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { FinanceReviewActionDto } from '../first-sales/dto/finance-review-action.dto'
import { BatchFinanceReviewDto } from '../first-sales/dto/batch-finance-review.dto'
import { QueryOrderListDto } from '../../common/dto/query-order-list.dto'

const THIRD_SALES_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const THIRD_SALES_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
const createThirdSalesUploadOptions = () => ({
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
    files: 21,
  },
  fileFilter: (_req: unknown, file: { mimetype: string; originalname: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase()
    if (!THIRD_SALES_UPLOAD_MIME_TYPES.includes(file.mimetype) || !THIRD_SALES_UPLOAD_EXTENSIONS.includes(extension)) {
      callback(new BadRequestException('上传文件类型不支持') as unknown as Error, false)
      return
    }
    callback(null, true)
  },
})

@Controller('third-sales')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('thirdSales.view')
export class ThirdSalesController {
  constructor(private readonly thirdSalesService: ThirdSalesService) {}

  @Get('users')
  findUsers() {
    return this.thirdSalesService.findUsers()
  }

  @Get('orders')
  @RequirePermission('thirdSales.orders.view')
  findOrders(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryOrderListDto) {
    return this.thirdSalesService.findOrders(currentUser, query)
  }

  @Get('receptions')
  @RequirePermission('thirdSales.reception.view')
  findReceptions(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryOrderListDto) {
    return this.thirdSalesService.findReceptions(currentUser, query)
  }

  @Post('search')
  searchCustomer(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: SearchThirdSalesCustomerDto) {
    return this.thirdSalesService.searchCustomer(currentUser, dto)
  }

  @Post('orders')
  @RequirePermission('thirdSales.create')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'paymentScreenshot', maxCount: 1 }, { name: 'evidenceFiles', maxCount: 20 }], createThirdSalesUploadOptions()),
  )
  createOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateThirdSalesOrderDto,
    @UploadedFiles()
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string }>
    },
  ) {
    return this.thirdSalesService.createOrder(currentUser, dto, files)
  }

  @Patch('orders/:id')
  @RequirePermission('thirdSales.edit')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'paymentScreenshot', maxCount: 1 }, { name: 'evidenceFiles', maxCount: 20 }], createThirdSalesUploadOptions()),
  )
  updateOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateThirdSalesOrderDto,
    @UploadedFiles()
    files: {
      paymentScreenshot?: Array<{ filename: string }>
      evidenceFiles?: Array<{ filename: string }>
    },
  ) {
    return this.thirdSalesService.updateOrder(currentUser, Number(id), dto, files)
  }

  @Delete('orders/:id')
  @RequirePermission('thirdSales.delete')
  removeOrder(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.thirdSalesService.removeOrder(currentUser, Number(id))
  }

  @Post('orders/:id/finance-review')
  @RequirePermission('thirdSales.review.single')
  reviewOrder(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: FinanceReviewActionDto) {
    return this.thirdSalesService.reviewOrder(currentUser, Number(id), dto)
  }

  @Post('orders/finance-review/batch')
  @RequirePermission('thirdSales.review.batch')
  batchReviewOrders(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: BatchFinanceReviewDto) {
    return this.thirdSalesService.batchReviewOrders(currentUser, dto)
  }
}
