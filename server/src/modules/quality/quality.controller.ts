import { Body, Controller, Get, Post, Query, UploadedFiles, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { QualityService } from './quality.service'
import { CreateQualityRecordDto } from './dto/create-quality-record.dto'

const QUALITY_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const QUALITY_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const createQualityUploadOptions = () => ({
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
    if (!QUALITY_UPLOAD_MIME_TYPES.includes(file.mimetype) || !QUALITY_UPLOAD_EXTENSIONS.includes(extension)) {
      callback(new BadRequestException('违规截图仅支持 jpg、png、webp') as unknown as Error, false)
      return
    }
    callback(null, true)
  },
})

@Controller('quality')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('quality.view')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('records')
  findRecords(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('responsibleId') responsibleId?: string,
  ) {
    return this.qualityService.findRecords(currentUser, responsibleId ? Number(responsibleId) : undefined)
  }

  @Get('responsibles')
  findResponsibles(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.qualityService.findResponsibles(currentUser)
  }

  @Post('records')
  @RequirePermission('quality.create')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'screenshot', maxCount: 1 }], createQualityUploadOptions()))
  createRecord(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateQualityRecordDto,
    @UploadedFiles()
    files: {
      screenshot?: Array<{ filename: string }>
    },
  ) {
    return this.qualityService.createRecord(currentUser, dto, files)
  }
}
