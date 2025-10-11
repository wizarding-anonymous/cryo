# Design Document - Frontend Application MVP

## Overview

Frontend Application - кросс-платформенное веб-приложение для MVP российской игровой платформы, построенное на Next.js 14 с 85-90% переиспользования кода между платформами. Обеспечивает современный пользовательский интерфейс для всех основных функций платформы.

## Technology Stack

### Core Technologies
- **Framework**: Next.js 14 + React 18 + TypeScript
- **Features**: SSR/SSG, SEO оптимизация, PWA готовность
- **Build**: Webpack (встроенный в Next.js)
- **Deployment**: Vercel / Docker
- **State Management**: Zustand (легковесная альтернатива Redux)
- **Styling**: Tailwind CSS + CSS Modules
- **API Client**: Axios с TypeScript типизацией
- **Forms**: React Hook Form + Zod валидация
- **Testing**: Jest + React Testing Library + Playwright (E2E)

### Cross-Platform Architecture
- **Web Application**: Next.js 14 (основная платформа)
- **Mobile Preparation**: Shared components для React Native
- **Desktop Preparation**: Shared logic для Tauri
- **Code Reuse**: 85-90% переиспользования между платформами

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph "Next.js 14 Application"
        NextApp[Next.js App Router]
        Pages[Pages & Components]
        State[Zustand Store]
        API[API Client Layer]
        SSR[SSR/SSG Engine]
    end
    
    subgraph "Cross-Platform Shared"
        Components[Shared Components]
        Utils[Shared Utils]
        Types[TypeScript Types]
        Hooks[Custom Hooks]
    end
    
    subgraph "API Gateway"
        Gateway[NestJS API Gateway]
    end
    
    subgraph "Backend Services (NestJS)"
        UserService[User Service]
        GameService[Game Catalog Service]
        PaymentService[Payment Service]
        LibraryService[Library Service]
        SocialService[Social Service]
        SecurityService[Security Service]
        NotificationService[Notification Service]
    end
    
    NextApp --> Pages
    Pages --> State
    Pages --> API
    Pages --> Components
    Components --> Utils
    Components --> Types
    Components --> Hooks
    API --> Gateway
    Gateway --> UserService
    Gateway --> GameService
    Gateway --> PaymentService
    Gateway --> LibraryService
    Gateway --> SocialService
    Gateway --> SecurityService
    Gateway --> NotificationService
```

## Components and Interfaces

### Next.js App Router Structure

#### App Directory Structure
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── library/page.tsx
│   ├── profile/page.tsx
│   └── friends/page.tsx
├── games/
│   ├── page.tsx (catalog)
│   └── [id]/page.tsx (details)
├── layout.tsx (root layout)
├── page.tsx (home)
├── loading.tsx
├── error.tsx
└── not-found.tsx
```

### Shared Components (Cross-Platform Ready)

#### Layout Components
- `RootLayout` - Next.js root layout с провайдерами
- `Header` - Адаптивная шапка с навигацией
- `Footer` - Подвал сайта
- `Sidebar` - Боковая панель для desktop
- `MobileNav` - Мобильная навигация
- `ThemeProvider` - Провайдер тем оформления

#### Game Components
- `GameCard` - Переиспользуемая карточка игры
- `GameGrid` - Сетка игр с виртуализацией
- `GameSearch` - Компонент поиска с debounce
- `GameFilters` - Фильтры с состоянием в URL
- `GameDetails` - Детальная информация об игре
- `PurchaseButton` - Кнопка покупки с состояниями

#### User Components
- `UserAvatar` - Аватар пользователя
- `UserProfile` - Профиль с редактированием
- `FriendsList` - Список друзей с поиском
- `ChatWindow` - Окно чата (подготовка к real-time)

#### UI Components (Design System)
- `Button` - Кнопки всех типов
- `Input` - Поля ввода с валидацией
- `Modal` - Модальные окна
- `Toast` - Уведомления
- `LoadingSpinner` - Индикаторы загрузки
- `ErrorBoundary` - Обработка ошибок

### State Management (Zustand) - Точно под User Service

#### Store Slices
```typescript
// stores/auth.ts - Точно под User Service API
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions - точно соответствуют User Service API
  register: (data: RegisterDto) => Promise<void>;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileDto) => Promise<void>;
  deleteProfile: () => Promise<void>;
  
  // Helpers
  setToken: (token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

// Реализация store
const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,

  register: async (data: RegisterDto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(data);
      const { user, accessToken } = response.data;
      
      set({ user, accessToken, isLoading: false });
      localStorage.setItem('accessToken', accessToken);
      apiClient.setToken(accessToken);
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  login: async (credentials: LoginDto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      const { user, accessToken } = response.data;
      
      set({ user, accessToken, isLoading: false });
      localStorage.setItem('accessToken', accessToken);
      apiClient.setToken(accessToken);
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout(); // Отправляет токен в blacklist
    } finally {
      set({ user: null, accessToken: null });
      localStorage.removeItem('accessToken');
      apiClient.setToken(null);
    }
  },

  getProfile: async () => {
    try {
      const response = await profileService.getProfile();
      set({ user: response.data });
    } catch (error) {
      if (error.status === 401) {
        get().clearAuth();
      }
      throw error;
    }
  },

  updateProfile: async (data: UpdateProfileDto) => {
    try {
      const response = await profileService.updateProfile(data);
      set({ user: response.data });
    } catch (error) {
      throw error;
    }
  },

  deleteProfile: async () => {
    await profileService.deleteProfile();
    get().clearAuth();
  },

  setToken: (token: string) => {
    set({ accessToken: token });
    localStorage.setItem('accessToken', token);
    apiClient.setToken(token);
  },

  clearAuth: () => {
    set({ user: null, accessToken: null });
    localStorage.removeItem('accessToken');
    apiClient.setToken(null);
  },

  isAuthenticated: () => {
    return !!get().accessToken;
  },
}));

// stores/games.ts
interface GamesStore {
  catalog: Game[];
  currentGame: Game | null;
  filters: GameFilters;
  searchQuery: string;
  isLoading: boolean;
  fetchGames: () => Promise<void>;
  setFilters: (filters: GameFilters) => void;
  searchGames: (query: string) => void;
}

// stores/library.ts
interface LibraryStore {
  games: LibraryGame[];
  downloads: DownloadStatus[];
  isLoading: boolean;
  fetchLibrary: () => Promise<void>;
  startDownload: (gameId: string) => Promise<void>;
}
```

## Data Models

### TypeScript Interfaces (Точно соответствуют User Service API)

```typescript
// types/user.ts - Точные типы из User Service
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
}

interface UpdateProfileDto {
  name?: string;
}

// API Response Types - точно как в User Service
interface StandardResponse<T> {
  statusCode: number;
  data: T;
}

interface AuthResponse {
  user: User;
  accessToken: string;
}

interface ErrorResponse {
  error: {
    code: 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'CONFLICT' | 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_SERVER_ERROR';
    message: string;
    details: {
      fields?: string[];
    };
  };
}

// types/game.ts
interface Game {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  price: number;
  discountPrice?: number;
  images: GameImage[];
  videos: GameVideo[];
  genre: string[];
  developer: string;
  publisher: string;
  releaseDate: Date;
  rating: number;
  reviewCount: number;
  systemRequirements: SystemRequirements;
  tags: string[];
}

interface GameImage {
  id: string;
  url: string;
  type: 'screenshot' | 'artwork' | 'logo';
  order: number;
}

interface LibraryGame {
  gameId: string;
  game: Game;
  purchaseDate: Date;
  downloadStatus: 'not_started' | 'downloading' | 'paused' | 'completed' | 'error';
  downloadProgress?: number;
  installPath?: string;
  lastPlayedAt?: Date;
  playtime: number;
}

// types/social.ts
interface Friend {
  id: string;
  user: User;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'game_invite';
  createdAt: Date;
  readAt?: Date;
}
```

### API Response Types

```typescript
// types/api.ts
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ValidationError[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ValidationError {
  field: string;
  message: string;
}
```

## REST API Integration

### API Client Architecture (Точная интеграция с User Service)

```typescript
// lib/api/client.ts - Точно под User Service API
class ApiClient {
  private baseURL: string = '/api'; // User Service prefix
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  async request<T>(endpoint: string, options: RequestOptions): Promise<StandardResponse<T>> {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      throw new ApiError(response.status, errorData.error);
    }

    return response.json();
  }
}

// services/auth.service.ts - Точные методы User Service
class AuthService {
  async register(data: RegisterDto): Promise<StandardResponse<AuthResponse>> {
    return apiClient.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async login(credentials: LoginDto): Promise<StandardResponse<AuthResponse>> {
    return apiClient.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async logout(): Promise<void> {
    await apiClient.request('/auth/logout', {
      method: 'POST'
    });
    // Ответ 204 No Content
  }
}

// services/profile.service.ts - Точные методы User Service
class ProfileService {
  async getProfile(): Promise<StandardResponse<User>> {
    return apiClient.request('/users/profile', {
      method: 'GET'
    });
  }

  async updateProfile(data: UpdateProfileDto): Promise<StandardResponse<User>> {
    return apiClient.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteProfile(): Promise<void> {
    await apiClient.request('/users/profile', {
      method: 'DELETE'
    });
    // Ответ 204 No Content
  }
}
```

### REST Endpoints Integration

```typescript
// services/games.service.ts
export const gamesService = {
  // GET /api/games
  getGames: (params: GameFilters) => apiClient.get<PaginatedResponse<Game>>('/games', { params }),
  
  // GET /api/games/:id
  getGame: (id: string) => apiClient.get<Game>(`/games/${id}`),
  
  // POST /api/games/:id/purchase
  purchaseGame: (id: string, paymentData: PaymentData) => 
    apiClient.post<PurchaseResult>(`/games/${id}/purchase`, paymentData),
};

// services/library.service.ts
export const libraryService = {
  // GET /api/library
  getLibrary: () => apiClient.get<LibraryGame[]>('/library'),
  
  // POST /api/library/:gameId/download
  startDownload: (gameId: string) => 
    apiClient.post<DownloadInfo>(`/library/${gameId}/download`),
};
```

## Error Handling

### Error Types & Handling

```typescript
// types/errors.ts
class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public errors?: ValidationError[]
  ) {
    super(message);
  }
}

// Error Boundary Component
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryProvider
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} onReset={resetError} />
      )}
    >
      {children}
    </ErrorBoundaryProvider>
  );
}

// Toast Notifications
export const toast = {
  success: (message: string) => showToast('success', message),
  error: (message: string) => showToast('error', message),
  warning: (message: string) => showToast('warning', message),
  info: (message: string) => showToast('info', message),
};
```

### Form Validation (Zod + React Hook Form)

```typescript
// schemas/auth.schema.ts
export const loginSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
});

// components/LoginForm.tsx
export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await authStore.login(data);
      router.push('/');
    } catch (error) {
      toast.error('Ошибка входа в систему');
    }
  };
}
```

## Testing Strategy

### Testing Stack
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: MSW (Mock Service Worker) для API
- **E2E Tests**: Playwright для критических пользовательских сценариев
- **Visual Tests**: Chromatic для компонентов

### Test Structure

```typescript
// __tests__/components/GameCard.test.tsx
describe('GameCard', () => {
  it('should render game information correctly', () => {
    render(<GameCard game={mockGame} />);
    expect(screen.getByText(mockGame.title)).toBeInTheDocument();
  });

  it('should handle purchase button click', async () => {
    const onPurchase = jest.fn();
    render(<GameCard game={mockGame} onPurchase={onPurchase} />);
    
    await user.click(screen.getByRole('button', { name: /купить/i }));
    expect(onPurchase).toHaveBeenCalledWith(mockGame.id);
  });
});

// __tests__/e2e/purchase-flow.spec.ts
test('user can purchase a game', async ({ page }) => {
  await page.goto('/games/1');
  await page.click('[data-testid="purchase-button"]');
  await page.fill('[data-testid="card-number"]', '4111111111111111');
  await page.click('[data-testid="confirm-purchase"]');
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## Performance Optimization

### Next.js Optimizations
- **SSR/SSG**: Статическая генерация для каталога игр
- **Image Optimization**: Next.js Image component с lazy loading
- **Code Splitting**: Автоматическое разделение кода по маршрутам
- **Bundle Analysis**: webpack-bundle-analyzer для оптимизации размера

### Runtime Optimizations
- **Virtual Scrolling**: Для больших списков игр
- **Debounced Search**: Оптимизация поиска
- **Memoization**: React.memo для тяжелых компонентов
- **Lazy Loading**: Динамический импорт компонентов