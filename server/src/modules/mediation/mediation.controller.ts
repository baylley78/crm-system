import { Body, Controller, Get, Post, Query, UseGuards, UploadedFiles, UseInterceptors, BadRequestException } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { MediationService } from './mediation.service'
import { SaveMediationCaseDto } from './dto/save-mediation-case.dto'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

const MEDIATION_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MEDIATION_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']

class QueryMediationCasesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number
}

const createMediationUploadOptions = () => ({
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
    files: 20,
  },
  fileFilter: (_: any, file: { mimetype: string; originalname: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname).toLowerCase()
    if (!MEDIATION_UPLOAD_MIME_TYPES.includes(file.mimetype) || !MEDIATION_UPLOAD_EXTENSIONS.includes(extension)) {
      callback(new BadRequestException('上传文件类型不支持') as unknown as Error, false)
      return
    }
    callback(null, true)
  },
})

@Controller('mediation')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('mediation.view')
export class MediationController {
  constructor(private readonly mediationService: MediationService) {}

  @Get('cases')
  findCases(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryMediationCasesDto) {
    return this.mediationService.findCases(currentUser, query)
  }

  @Get('users')
  findUsers() {
    return this.mediationService.findUsers()
  }

  @Post('cases/follow')
  @RequirePermission('mediation.edit')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'evidenceFiles', maxCount: 20 }], createMediationUploadOptions()),
  )
  followCase(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: SaveMediationCaseDto,
    @UploadedFiles()
    files: {
      evidenceFiles?: Array<{ filename: string }>
    },
  ) {
    return this.mediationService.saveCase(currentUser, { ...dto, isCompleted: false }, files)
  }

  @Post('cases/complete')
  @RequirePermission('mediation.complete')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'evidenceFiles', maxCount: 20 }], createMediationUploadOptions()),
  )
  completeCase(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: SaveMediationCaseDto,
    @UploadedFiles()
    files: {
      evidenceFiles?: Array<{ filename: string }>
    },
  ) {
    return this.mediationService.saveCase(currentUser, { ...dto, isCompleted: true }, files)
  }
}
