# Дизайн Workshop Service

## Обзор

Workshop Service - это микросервис для управления пользовательским контентом (моды, карты, скины, дополнения) российской Steam-платформы. Сервис обеспечивает создание, публикацию, модерацию и распространение пользовательского контента с интеграцией в игры и поддержкой российского законодательства.

## Архитектура

### Высокоуровневая архитектура

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web App]
        GAME[Game Client]
        MOBILE[Mobile App]
        EDITOR[Content Editor]
    end
    
    subgraph "API Gateway"
        GW[API Gateway]
    end
    
    subgraph "Workshop Service"
        API[Workshop API]
        CONTENT_MGR[Content Manager]
        MODERATION[Moderation Engine]
        DISTRIBUTION[Distribution Manager]
        COMPATIBILITY[Compatibility Checker]
        ANALYTICS[Analytics Engine]
    end
    
    subgraph "Content Processing"
        UPLOAD[Upload Handler]
        VALIDATOR[Content Validator]
        CONVERTER[Format Converter]
        SCANNER[Security Scanner]
        THUMBNAIL[Thumbnail Generator]
    end
    
    subgraph "External Services"
        ANTIVIRUS[Antivirus Scanner]
        AI_MOD[AI Moderation]
        CDN[Content Delivery Network]
    end
    
    subgraph "Data Storage"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        S3[(File Storage)]
      