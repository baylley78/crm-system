import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const RequiredPermission = createParamDecorator((_: unknown, context: ExecutionContext): string | undefined => {
  const request = context.switchToHttp().getRequest<Request & { requiredPermission?: string }>()
  return request.requiredPermission
})
