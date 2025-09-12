import { Controller } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // This controller is intentionally left empty for now.
  // It can be used for administrative user management endpoints in the future.
}
