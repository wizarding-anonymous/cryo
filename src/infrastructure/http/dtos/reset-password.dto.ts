import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The password reset token from the email link' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123', description: 'The new password' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
