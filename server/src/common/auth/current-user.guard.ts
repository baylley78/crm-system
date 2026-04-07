import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService, type AuthenticatedUser } from '../../modules/auth/auth.service'

type AuthenticatedRequest = Request & {
  headers: Record<string, string | string[] | undefined>
  currentUser?: AuthenticatedUser
}

@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authorizationHeader = request.headers.authorization
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录或登录已失效')
    }

    const token = authorization.slice(7).trim()
    if (!token) {
      throw new UnauthorizedException('未登录或登录已失效')
    }

    request.currentUser = await this.authService.getUserByToken(token)
    return true
  }
}
