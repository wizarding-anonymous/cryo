import {
  Controller,
} from '@nestjs/common';
import {
  ApiTags,
} from '@nestjs/swagger';

// Profile endpoints have been moved to Auth Service
// User Service now only handles internal user data management
@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor() {}

  // All profile endpoints (GET /profile, PUT /profile, DELETE /profile) 
  // have been moved to Auth Service as they require authentication.
  // User Service now focuses only on user data management for internal service communication.
}