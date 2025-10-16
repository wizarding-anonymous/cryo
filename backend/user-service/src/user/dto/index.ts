// Основные DTO
export { CreateUserDto } from './create-user.dto';
export { UpdateProfileDto } from './update-profile.dto';
export { UpdatePreferencesDto } from './update-preferences.dto';
export { UpdatePrivacySettingsDto } from './update-privacy-settings.dto';
export { UploadAvatarDto, AvatarResponseDto } from './upload-avatar.dto';

// Batch операции DTO
export { BatchCreateUsersDto } from './batch-create-users.dto';
export { BatchLookupUsersDto } from './batch-lookup-users.dto';
export { BatchUpdateUsersDto } from './batch-update-users.dto';
export { BatchUserIdsDto } from './batch-user-ids.dto';
export { BatchProcessingOptionsDto } from './batch-processing-options.dto';

// Internal API DTO для межсервисного взаимодействия
export { InternalUserResponseDto } from './internal-user-response.dto';
export {
  InternalProfileResponseDto,
  InternalBatchProfilesResponseDto,
} from './internal-profile-response.dto';
export {
  InternalBillingInfoDto,
  UpdateBillingInfoDto,
} from './internal-billing-info.dto';
export { InternalBatchProfilesRequestDto } from './internal-batch-profiles.dto';
