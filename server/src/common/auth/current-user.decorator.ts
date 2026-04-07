import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedUser } from '../../modules/auth/auth.service'

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
  const request = context.switchToHttp().getRequest<Request & { currentUser?: AuthenticatedUser }>()
  return request.currentUser
})
