import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { ApprovalsService } from './approvals.service'
import { CreateApprovalDto } from './dto/create-approval.dto'
import { ApprovalActionDto } from './dto/approval-action.dto'
import { QueryApprovalsDto } from './dto/query-approvals.dto'
import { ApprovalPayDto } from './dto/approval-pay.dto'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'

const APPROVAL_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const APPROVAL_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
const createApprovalUploadOptions = () => ({
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
    files: 1,
  },
  fileFilter: (_req: unknown, file: { mimetype: string; originalname: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase()
    if (!APPROVAL_UPLOAD_MIME_TYPES.includes(file.mimetype) || !APPROVAL_UPLOAD_EXTENSIONS.includes(extension)) {
      callback(new BadRequestException('上传文件类型不支持') as unknown as Error, false)
      return
    }
    callback(null, true)
  },
})

@Controller('approvals')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('oa.approvals.view')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryApprovalsDto) {
    return this.approvalsService.findAll(currentUser, query)
  }

  @Post()
  @RequirePermission('oa.approvals.create')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'reimbursementVoucher', maxCount: 1 }], createApprovalUploadOptions()))
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateApprovalDto,
    @UploadedFiles()
    files: {
      reimbursementVoucher?: Array<{ filename: string }>
    },
  ) {
    return this.approvalsService.create(currentUser, dto, {
      reimbursementVoucher: files.reimbursementVoucher?.[0],
    })
  }

  @Post(':id/action')
  @RequirePermission('oa.approvals.review')
  action(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser, @Body() dto: ApprovalActionDto) {
    return this.approvalsService.action(Number(id), currentUser, dto)
  }

  @Post(':id/pay')
  @RequirePermission('oa.approvals.pay')
  pay(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser, @Body() dto: ApprovalPayDto) {
    return this.approvalsService.pay(Number(id), currentUser, dto)
  }
}
