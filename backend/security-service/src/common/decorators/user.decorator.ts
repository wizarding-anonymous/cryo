import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';

/**
 * Extracts the user object attached to the request by the AuthGuard.
 * Example:
 * ```
 * @Get()
 * findOne(@User() user: AuthUser) {
 *   console.log(user);
 * }
 * ```
 */
export const User = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
