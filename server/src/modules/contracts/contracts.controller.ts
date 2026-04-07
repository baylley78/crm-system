import { Body, Controller, Get, Param, Post, UploadedFiles, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { ContractsService } from './contracts.service'
import { CreateContractArchiveDto } from './dto/create-contract-archive.dto'

const CONTRACT_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const CONTRACT_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
const createContractUploadOptions = () => ({
  storage: diskStorage({
    destination: 'uploads',
    filename: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase()
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      callback(null, `contract-${uniqueSuffix}${extension}`)
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req: unknown, file: { mimetype: string; originalname: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase()
    if (!CONTRACT_UPLOAD_MIME_TYPES.includes(file.mimetype) || !CONTRACT_UPLOAD_EXTENSIONS.includes(extension)) {
      callback(new BadRequestException('上传文件类型不支持') as unknown as Error, false)
      return
    }
    callback(null, true)
  },
})

@Controller('contracts')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('contracts.view')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.contractsService.findAll(currentUser)
  }

  @Get('customers')
  @RequirePermission('contracts.customers.view')
  findCustomers(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.contractsService.findCustomers(currentUser)
  }

  @Get('users')
  @RequirePermission('contracts.users.view')
  findUsers() {
    return this.contractsService.findUsers()
  }

  @Get('customer/:id/orders')
  @RequirePermission('contracts.orders.view')
  findCustomerOrders(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.contractsService.findCustomerOrders(currentUser, Number(id))
  }

  @Post()
  @RequirePermission('contracts.create')
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'contractFile', maxCount: 1 }],
      createContractUploadOptions(),
    ),
  )
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateContractArchiveDto,
    @UploadedFiles()
    files: {
      contractFile?: Array<{ filename: string }>
    },
  ) {
    const fileUrl = files.contractFile?.[0] ? `/uploads/${files.contractFile[0].filename}` : undefined
    return this.contractsService.create(currentUser, dto, fileUrl)
  }
}
