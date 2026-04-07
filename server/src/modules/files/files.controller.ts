import { Controller, Get, Param, Query, Req, Res, UnauthorizedException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService, type AuthenticatedUser } from '../auth/auth.service'
import { FilesService } from './files.service'

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly authService: AuthService,
  ) {}

  @Get(':filename')
  async download(
    @Param('filename') filename: string,
    @Query('token') tokenQuery: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const currentUser = await this.resolveCurrentUser(req, tokenQuery)
    const file = await this.filesService.getAuthorizedFile(currentUser, filename)
    return res.sendFile(file.absolutePath)
  }

  private async resolveCurrentUser(req: Request, tokenQuery?: string) {
    const authorizationHeader = req.headers.authorization
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    const token = tokenQuery?.trim() || bearerToken

    if (!token) {
      throw new UnauthorizedException('未登录或登录已失效')
    }

    return this.authService.getUserByToken(token)
  }
}
