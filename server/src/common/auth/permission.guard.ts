import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator'
import type { AuthenticatedUser } from '../../modules/auth/auth.service'

type PermissionRequest = Request & {
  currentUser?: AuthenticatedUser
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION_KEY, [context.getHandler(), context.getClass()])
    if (!requiredPermission) {
      return true
    }

    const request = context.switchToHttp().getRequest<PermissionRequest>()
    const currentUser = request.currentUser
    if (!currentUser) {
      throw new ForbiddenException('无权访问该功能')
    }

    if (!currentUser.permissions?.includes(requiredPermission)) {
      throw new ForbiddenException('无权访问该功能')
    }

    return true
  }
}
