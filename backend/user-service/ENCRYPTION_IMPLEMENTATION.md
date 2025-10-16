# Encryption Implementation for User Service

## Overview

This document describes the implementation of encryption for sensitive user data in the User Service. The encryption system protects user preferences and privacy settings using AES-256-GCM encryption.

## Architecture

### Components

1. **EncryptionService** - Core encryption/decryption service
2. **UserEncryptionService** - User-specific encryption operations
3. **EncryptionTransformer** - TypeORM transformer for automatic encryption
4. **EncryptionModule** - NestJS module for dependency injection

### Encrypted Fields

The following fields in the User entity are encrypted:
- `preferences` (UserPreferences object)
- `privacySettings` (PrivacySettings object)

## Implementation Details

### Encryption Algorithm

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with salt
- **IV**: Random 16-byte initialization vector per encryption
- **Authentication**: Built-in authentication tag with GCM mode

### Database Storage

Encrypted fields are stored as `TEXT` columns in PostgreSQL instead of `JSONB`:
- `preferences` → `TEXT` (encrypted JSON string)
- `privacy_settings` → `TEXT` (encrypted JSON string)

### Key Management

- Encryption key is provided via `ENCRYPTION_KEY` environment variable
- Key must be at least 32 characters long
- Key is derived using scrypt with a service-specific salt
- Key rotation is supported by updating the environment variable

## Usage Examples

### Basic Encryption/Decryption

```typescript
// Inject the service
constructor(private readonly encryptionService: EncryptionService) {}

// Encrypt data
const preferences = { language: 'en', theme: 'dark' };
const encrypted = this.encryptionService.encryptObject(preferences);

// Decrypt data
const decrypted = this.encryptionService.decryptObject<UserPreferences>(encrypted);
```

### User-Specific Operations

```typescript
// Inject the user encryption service
constructor(private readonly userEncryptionService: UserEncryptionService) {}

// Prepare user for saving (encrypts sensitive fields)
const preparedUser = this.userEncryptionService.prepareUserForSave(user);
await this.userRepository.save(preparedUser);

// Prepare user after loading (decrypts sensitive fields)
const user = await this.userRepository.findOne({ where: { id } });
const decryptedUser = this.userEncryptionService.prepareUserAfterLoad(user);
```

## Security Features

### Data Protection

1. **Encryption at Rest**: Sensitive data is encrypted before storage
2. **Authentication**: GCM mode provides built-in authentication
3. **Unique IVs**: Each encryption uses a unique initialization vector
4. **Key Derivation**: Keys are derived using cryptographically secure methods

### Error Handling

1. **Graceful Degradation**: Failed decryption returns null instead of crashing
2. **Logging**: Encryption/decryption errors are logged for monitoring
3. **Validation**: Input validation prevents invalid data processing

### Performance Considerations

1. **Lazy Decryption**: Data is only decrypted when accessed
2. **Caching**: Decrypted data is cached to avoid repeated decryption
3. **Batch Operations**: Supports batch encryption/decryption for performance

## Configuration

### Environment Variables

```bash
# Required: Encryption key (minimum 32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

### Validation

The system validates:
- Encryption key presence and minimum length
- Data integrity during decryption
- Input data format and structure

## Migration

### Database Migration

A migration is provided to convert existing JSONB fields to TEXT:

```sql
-- Convert preferences from jsonb to text
ALTER TABLE "users" ALTER COLUMN "preferences" TYPE text;

-- Convert privacy_settings from jsonb to text  
ALTER TABLE "users" ALTER COLUMN "privacy_settings" TYPE text;

-- Add comments indicating encrypted storage
COMMENT ON COLUMN "users"."preferences" IS 'Encrypted user preferences data';
COMMENT ON COLUMN "users"."privacy_settings" IS 'Encrypted privacy settings data';
```

### Data Migration

Existing unencrypted data will need to be migrated:

1. **Backup**: Create a full database backup before migration
2. **Encrypt**: Run a migration script to encrypt existing data
3. **Validate**: Verify all data can be decrypted correctly
4. **Deploy**: Deploy the new encryption-enabled code

## Monitoring and Maintenance

### Metrics

The system provides metrics for:
- Encryption/decryption operation counts
- Error rates for encryption operations
- Performance metrics for encryption operations

### Logging

Structured logging includes:
- Encryption operation success/failure
- Performance timing for operations
- Error details for troubleshooting

### Health Checks

Health checks verify:
- Encryption service availability
- Key accessibility
- Basic encrypt/decrypt functionality

## Testing

### Unit Tests

Comprehensive unit tests cover:
- Basic encryption/decryption operations
- Error handling scenarios
- Edge cases (null/undefined data)
- Performance characteristics

### Integration Tests

Integration tests verify:
- Database storage and retrieval
- Service integration
- End-to-end data flow

## Security Best Practices

### Key Management

1. **Rotation**: Regularly rotate encryption keys
2. **Storage**: Store keys securely (environment variables, key management systems)
3. **Access**: Limit access to encryption keys
4. **Backup**: Securely backup encryption keys

### Data Handling

1. **Minimal Exposure**: Decrypt data only when necessary
2. **Memory Management**: Clear sensitive data from memory
3. **Logging**: Never log decrypted sensitive data
4. **Transport**: Use TLS for data in transit

### Compliance

The implementation supports:
- **GDPR**: Right to be forgotten (encrypted data can be securely deleted)
- **Data Minimization**: Only sensitive fields are encrypted
- **Audit Trail**: All encryption operations are logged

## Troubleshooting

### Common Issues

1. **Decryption Failures**: Usually caused by key changes or corrupted data
2. **Performance Issues**: May indicate need for caching optimization
3. **Key Errors**: Verify ENCRYPTION_KEY environment variable

### Recovery Procedures

1. **Key Loss**: Encrypted data cannot be recovered without the key
2. **Corruption**: Use database backups to restore corrupted data
3. **Migration Issues**: Rollback procedures are available

## Future Enhancements

### Planned Features

1. **Key Rotation**: Automated key rotation support
2. **Multiple Keys**: Support for multiple encryption keys
3. **Field-Level Control**: Granular control over encrypted fields
4. **Performance Optimization**: Further caching and optimization

### Considerations

1. **Searchability**: Encrypted fields cannot be searched directly
2. **Indexing**: Encrypted fields cannot be indexed for performance
3. **Backup**: Encrypted backups require key management
4. **Compliance**: Regular security audits recommended