// Common utility types used across the application

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type ActionState<T = any> = {
  status: LoadingState;
  data?: T;
  error?: Error;
};

// Common entity patterns
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface UserEntity {
  user_id: string;
  display_name: string;
  username?: string;
}

// Common API patterns
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Form state patterns
export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
}

// Search patterns
export interface SearchFilters {
  query?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Permission patterns
export type Permission = 'read' | 'write' | 'admin' | 'owner';

export interface WithPermissions {
  permissions: Permission[];
}

// Date range patterns
export interface DateRange {
  from: Date;
  to: Date;
}