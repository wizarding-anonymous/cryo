# User Service - Архитектурная диаграмма

## Общая архитектура системы

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web App<br/>Next.js]
        MOBILE[Mobile App<br/>React Native]
        DESKTOP[Desktop App<br/>Tauri]
    end

    subgraph "API Gateway Layer"
        GATEWAY[API Gateway<br/>NestJS]
    end

    subgraph "User Service"
        subgraph "Infrastructure Layer"
            HTTP[HTTP Controllers<br/>REST API]
            WS[WebSocket<br/>Real-time]
            AUTH[Auth Guards<br/>JWT/OAuth]
        end

        subgraph "Application Layer"
            US[User Service]
            AS[Auth Service]
            RS[Reputation Service]
            CS[Customization Service]
            CORP[Corporate Service]
            MFA[MFA Service]
        end

        subgraph "Domain Layer"
            USER[User Entity]
            ROLE[Role Entity]
            SESSION[Session Entity]
            REP[Reputation Entity]
        end

        subgraph "Infrastructure Persistence"
            REPO[Repositories]
            EVENTS[Event Publisher]
        end
    end

    subgraph "External Services"
        SOCIAL[Social Service]
        PAYMENT[Payment Service]
        NOTIFICATION[Notification Service]
        ANALYTICS[Analytics Service]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL<br/>Primary DB)]
        REDIS[(Redis<br/>Cache & Sessions)]
        KAFKA[Apache Kafka<br/>Event Bus]
    end

    subgraph "Russian SSO Providers"
        GOSUSLUGI[Госуслуги<br/>ЕСИА]
        YANDEX[Яндекс ID]
        VK[VK ID]
        SBER[Сбер ID]
        MYTEAM[MyTeam]
        ASTRA[Astra Linux AD]
    end

    %% Client connections
    WEB --> GATEWAY
    MOBILE --> GATEWAY
    DESKTOP --> GATEWAY

    %% Gateway to User Service
    GATEWAY --> HTTP
    GATEWAY --> WS

    %% Infrastructure to Application
    HTTP --> US
    HTTP --> AS
    HTTP --> RS
    HTTP --> CS
    HTTP --> CORP
    HTTP --> MFA
    AUTH --> AS

    %% Application to Domain
    US --> USER
    AS --> USER
    AS --> SESSION
    RS --> REP
    CORP --> ROLE

    %% Application to Infrastructure
    US --> REPO
    AS --> REPO
    RS --> REPO
    CS --> REPO
    CORP --> REPO
    MFA --> REPO

    %% Events
    US --> EVENTS
    AS --> EVENTS
    RS --> EVENTS
    CORP --> EVENTS

    %% Data connections
    REPO --> POSTGRES
    REPO --> REDIS
    EVENTS --> KAFKA

    %% External integrations
    EVENTS --> SOCIAL
    EVENTS --> PAYMENT
    EVENTS --> NOTIFICATION
    EVENTS --> ANALYTICS

    %% SSO integrations
    AS --> GOSUSLUGI
    AS --> YANDEX
    AS --> VK
    AS --> SBER
    AS --> MYTEAM
    AS --> ASTRA

    %% Styling
    classDef client fill:#e1f5fe
    classDef service fill:#f3e5f5
    classDef data fill:#e8f5e8
    classDef external fill:#fff3e0
    classDef sso fill:#ffebee

    class WEB,MOBILE,DESKTOP client
    class US,AS,RS,CS,CORP,MFA service
    class POSTGRES,REDIS,KAFKA data
    class SOCIAL,PAYMENT,NOTIFICATION,ANALYTICS external
    class GOSUSLUGI,YANDEX,VK,SBER,MYTEAM,ASTRA sso
```

## Детальная архитектура User Service

```mermaid
graph TB
    subgraph "HTTP Layer"
        AC[Auth Controller]
        UC[User Controller]
        RC[Reputation Controller]
        CC[Customization Controller]
        CORC[Corporate Controller]
        MC[MFA Controller]
    end

    subgraph "Service Layer"
        AS[Auth Service]
        US[User Service]
        RS[Reputation Service]
        CS[Customization Service]
        CORS[Corporate Service]
        MS[MFA Service]
        SS[Session Service]
        UTS[User Token Service]
        PRS[Password Reset Service]
    end

    subgraph "Domain Entities"
        USER[User]
        ROLE[Role]
        USERROLE[UserRole]
        SESSION[Session]
        REPUTATION[ReputationEntry]
        SOCIAL[SocialAccount]
        TOKEN[UserToken]
        CORP[CorporateProfile]
    end

    subgraph "Value Objects"
        EMAIL[Email VO]
        PASSWORD[Password VO]
        USERNAME[Username VO]
        DEVICE[DeviceInfo VO]
        INN[INN VO]
        OGRN[OGRN VO]
    end

    subgraph "Repositories"
        UR[User Repository]
        RR[Role Repository]
        URR[UserRole Repository]
        SR[Session Repository]
        REP_R[Reputation Repository]
        SAR[SocialAccount Repository]
        TR[Token Repository]
        CR[Corporate Repository]
    end

    subgraph "External Integrations"
        EP[Event Publisher]
        KAFKA_INT[Kafka Integration]
        SSO_INT[SSO Integrations]
        EMAIL_INT[Email Service]
    end

    %% Controller to Service connections
    AC --> AS
    AC --> SS
    AC --> UTS
    AC --> PRS
    UC --> US
    RC --> RS
    CC --> CS
    CORC --> CORS
    MC --> MS

    %% Service to Entity connections
    AS --> USER
    AS --> SESSION
    AS --> SOCIAL
    AS --> TOKEN
    US --> USER
    US --> ROLE
    US --> USERROLE
    RS --> REPUTATION
    CS --> USER
    CORS --> CORP
    CORS --> USER
    MS --> USER

    %% Entity to Value Object connections
    USER --> EMAIL
    USER --> PASSWORD
    USER --> USERNAME
    SESSION --> DEVICE
    CORP --> INN
    CORP --> OGRN

    %% Service to Repository connections
    AS --> UR
    AS --> SR
    AS --> SAR
    AS --> TR
    US --> UR
    US --> RR
    US --> URR
    RS --> REP_R
    CS --> UR
    CORS --> CR
    CORS --> UR
    MS --> UR

    %% External integrations
    AS --> EP
    US --> EP
    RS --> EP
    CORS --> EP
    EP --> KAFKA_INT
    AS --> SSO_INT
    PRS --> EMAIL_INT

    %% Styling
    classDef controller fill:#bbdefb
    classDef service fill:#c8e6c9
    classDef entity fill:#ffcdd2
    classDef vo fill:#f8bbd9
    classDef repo fill:#dcedc8
    classDef external fill:#ffe0b2

    class AC,UC,RC,CC,CORC,MC controller
    class AS,US,RS,CS,CORS,MS,SS,UTS,PRS service
    class USER,ROLE,USERROLE,SESSION,REPUTATION,SOCIAL,TOKEN,CORP entity
    class EMAIL,PASSWORD,USERNAME,DEVICE,INN,OGRN vo
    class UR,RR,URR,SR,REP_R,SAR,TR,CR repo
    class EP,KAFKA_INT,SSO_INT,EMAIL_INT external
```

## Event-Driven Architecture

```mermaid
sequenceDiagram
    participant US as User Service
    participant K as Kafka
    participant SS as Social Service
    participant PS as Payment Service
    participant NS as Notification Service

    Note over US,NS: User Registration Flow
    US->>K: UserRegistered Event
    K->>SS: Process new user
    K->>NS: Send welcome notification
    
    Note over US,NS: User Profile Update
    US->>K: UserProfileUpdated Event
    K->>SS: Sync profile data
    K->>NS: Notify friends of changes

    Note over US,NS: Corporate Profile Creation
    US->>K: CorporateProfileCreated Event
    K->>PS: Setup billing
    K->>NS: Notify admin team

    Note over US,NS: Reputation Change
    US->>K: ReputationChanged Event
    K->>SS: Update social status
    K->>NS: Achievement notifications

    Note over US,NS: User Blocked
    US->>K: UserBlocked Event
    K->>PS: Suspend payments
    K->>SS: Restrict social features
    K->>NS: Send notification
```

## Security Architecture

```mermaid
graph TB
    subgraph "Authentication Layer"
        JWT[JWT Tokens<br/>15min access + 7d refresh]
        MFA_AUTH[MFA Verification<br/>TOTP + SMS + Backup]
        OAUTH[OAuth 2.0<br/>Russian Providers]
    end

    subgraph "Authorization Layer"
        RBAC[Role-Based Access Control]
        GUARDS[Route Guards]
        PERMISSIONS[Permission System]
    end

    subgraph "Data Protection"
        ENCRYPTION[Data Encryption<br/>AES-256 + GOST]
        HASHING[Password Hashing<br/>bcrypt + salt]
        PII[PII Protection<br/>152-ФЗ Compliance]
    end

    subgraph "Security Monitoring"
        AUDIT[Audit Logging]
        RATE_LIMIT[Rate Limiting<br/>Redis-based]
        FRAUD[Fraud Detection<br/>ML-based]
    end

    subgraph "Russian Compliance"
        GOST_CRYPTO[ГОСТ Cryptography]
        DATA_RESIDENCY[Data Residency<br/>Russian Territory]
        PERSONAL_DATA[Personal Data<br/>Protection Laws]
    end

    %% Connections
    JWT --> RBAC
    MFA_AUTH --> JWT
    OAUTH --> JWT
    RBAC --> GUARDS
    GUARDS --> PERMISSIONS
    ENCRYPTION --> PII
    HASHING --> ENCRYPTION
    AUDIT --> RATE_LIMIT
    RATE_LIMIT --> FRAUD
    GOST_CRYPTO --> ENCRYPTION
    DATA_RESIDENCY --> PII
    PERSONAL_DATA --> PII

    %% Styling
    classDef auth fill:#e3f2fd
    classDef authz fill:#f1f8e9
    classDef protection fill:#fff3e0
    classDef monitoring fill:#fce4ec
    classDef compliance fill:#ffebee

    class JWT,MFA_AUTH,OAUTH auth
    class RBAC,GUARDS,PERMISSIONS authz
    class ENCRYPTION,HASHING,PII protection
    class AUDIT,RATE_LIMIT,FRAUD monitoring
    class GOST_CRYPTO,DATA_RESIDENCY,PERSONAL_DATA compliance
```

## Database Schema Overview

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar email UK
        varchar username UK
        varchar password_hash
        boolean email_verified
        varchar phone_number
        boolean phone_verified
        jsonb profile
        jsonb privacy_settings
        jsonb notification_settings
        boolean mfa_enabled
        jsonb mfa_methods
        varchar mfa_secret
        text[] backup_codes
        boolean is_active
        boolean is_blocked
        varchar block_reason
        timestamp block_expires_at
        integer reputation_score
        jsonb customization_preferences
        varchar first_name
        varchar last_name
        boolean created_via_sso
        varchar sso_provider_id
        timestamp created_at
        timestamp updated_at
        timestamp last_login_at
    }

    ROLES {
        uuid id PK
        varchar name UK
        text description
        text[] permissions
        timestamp created_at
    }

    USER_ROLES {
        uuid user_id PK,FK
        uuid role_id PK,FK
        timestamp assigned_at
        uuid assigned_by
        timestamp expires_at
    }

    USER_SESSIONS {
        uuid id PK
        uuid user_id FK
        jsonb device_info
        inet ip_address
        text user_agent
        varchar access_token_hash
        varchar refresh_token_hash
        timestamp created_at
        timestamp last_activity_at
        timestamp expires_at
        boolean is_active
        varchar terminated_reason
        timestamp terminated_at
    }

    SOCIAL_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        varchar provider
        varchar provider_user_id
        jsonb provider_data
        timestamp linked_at
    }

    REPUTATION_HISTORY {
        uuid id PK
        uuid user_id FK
        integer change
        text reason
        varchar source
        varchar source_id
        timestamp created_at
    }

    CORPORATE_PROFILES {
        uuid id PK
        uuid admin_user_id FK,UK
        jsonb company_info
        jsonb organization
        jsonb subscription
        jsonb integrations
        jsonb policies
        jsonb usage
        timestamp created_at
        timestamp updated_at
    }

    USER_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token UK
        varchar token_type
        boolean is_used
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }

    %% Relationships
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned_to
    USERS ||--o{ USER_SESSIONS : creates
    USERS ||--o{ SOCIAL_ACCOUNTS : links
    USERS ||--o{ REPUTATION_HISTORY : earns
    USERS ||--o| CORPORATE_PROFILES : administers
    USERS ||--o{ USER_TOKENS : generates
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[NGINX Ingress<br/>SSL Termination]
    end

    subgraph "Kubernetes Cluster"
        subgraph "User Service Pods"
            POD1[User Service Pod 1]
            POD2[User Service Pod 2]
            POD3[User Service Pod 3]
        end

        subgraph "Databases"
            PG_PRIMARY[(PostgreSQL Primary)]
            PG_REPLICA[(PostgreSQL Replica)]
            REDIS_CLUSTER[(Redis Cluster)]
        end

        subgraph "Message Queue"
            KAFKA_CLUSTER[Kafka Cluster<br/>3 Brokers]
        end

        subgraph "Monitoring"
            PROMETHEUS[Prometheus]
            GRAFANA[Grafana]
            JAEGER[Jaeger Tracing]
        end
    end

    subgraph "External Services"
        RUSSIAN_SSO[Russian SSO<br/>Providers]
        EMAIL_SVC[Email Service]
        SMS_SVC[SMS Service]
    end

    %% Connections
    LB --> POD1
    LB --> POD2
    LB --> POD3

    POD1 --> PG_PRIMARY
    POD2 --> PG_PRIMARY
    POD3 --> PG_PRIMARY

    POD1 --> PG_REPLICA
    POD2 --> PG_REPLICA
    POD3 --> PG_REPLICA

    POD1 --> REDIS_CLUSTER
    POD2 --> REDIS_CLUSTER
    POD3 --> REDIS_CLUSTER

    POD1 --> KAFKA_CLUSTER
    POD2 --> KAFKA_CLUSTER
    POD3 --> KAFKA_CLUSTER

    POD1 --> PROMETHEUS
    POD2 --> PROMETHEUS
    POD3 --> PROMETHEUS

    POD1 --> RUSSIAN_SSO
    POD2 --> EMAIL_SVC
    POD3 --> SMS_SVC

    %% Styling
    classDef pod fill:#e8f5e8
    classDef db fill:#e3f2fd
    classDef monitoring fill:#fff3e0
    classDef external fill:#ffebee

    class POD1,POD2,POD3 pod
    class PG_PRIMARY,PG_REPLICA,REDIS_CLUSTER,KAFKA_CLUSTER db
    class PROMETHEUS,GRAFANA,JAEGER monitoring
    class RUSSIAN_SSO,EMAIL_SVC,SMS_SVC external
```

---

**Последнее обновление:** 1 сентября 2025  
**Версия:** 2.0.0  
**Статус:** Production Ready ✅