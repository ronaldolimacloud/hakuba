import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

export interface GraphQLError {
  message: string;
  errorType?: string;
  errorInfo?: any;
}

export interface ErrorResponse {
  errors?: GraphQLError[];
  message?: string;
}

export class ErrorHandler {
  private static retryAttempts = new Map<string, number>();
  private static maxRetries = 3;
  private static retryDelay = 1000; // 1 second base delay

  /**
   * Handle GraphQL errors with user-friendly messages
   */
  static handleGraphQLError(error: ErrorResponse, context?: string): string {
    console.error(`GraphQL Error${context ? ` in ${context}` : ''}:`, error);

    // Missing backend configuration
    if (error.message?.includes('AppSync URL is not configured')) {
      return 'Trip planner backend is not configured. Set EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars) or update expo.extra before retrying.';
    }

    // Handle network errors
    if (error.message?.includes('Network request failed') || 
        error.message?.includes('fetch')) {
      return 'Network connection error. Please check your internet connection and try again.';
    }

    // Handle GraphQL errors array
    if (error.errors && error.errors.length > 0) {
      const graphqlError = error.errors[0];
      
      switch (graphqlError.errorType) {
        case 'Unauthorized':
          return 'You don\'t have permission to perform this action.';
        case 'ValidationException':
          return 'Invalid data provided. Please check your input and try again.';
        case 'ConditionalCheckFailedException':
          return 'This item has been modified by another user. Please refresh and try again.';
        case 'ResourceNotFoundException':
          return 'The requested item could not be found.';
        case 'LimitExceededException':
          return 'Rate limit exceeded. Please wait a moment and try again.';
        case 'ServiceException':
          return 'Service temporarily unavailable. Please try again later.';
        default:
          // Return the actual error message if it's user-friendly
          if (graphqlError.message && !graphqlError.message.includes('DynamoDB') && 
              !graphqlError.message.includes('Lambda') && 
              !graphqlError.message.includes('AppSync')) {
            return graphqlError.message;
          }
          return 'An unexpected error occurred. Please try again.';
      }
    }

    // Handle direct error messages
    if (error.message) {
      // Filter out technical error messages
      if (error.message.includes('DynamoDB') || 
          error.message.includes('Lambda') || 
          error.message.includes('AppSync') ||
          error.message.includes('Internal server error')) {
        return 'Service temporarily unavailable. Please try again later.';
      }
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Show error alert with user-friendly message
   */
  static showError(error: ErrorResponse, title: string = 'Error', context?: string) {
    const message = this.handleGraphQLError(error, context);
    Alert.alert(title, message);
  }

  /**
   * Check network connectivity
   */
  static async checkNetworkConnectivity(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      const isReachable =
        netInfo.isInternetReachable === null || netInfo.isInternetReachable === undefined
          ? true
          : netInfo.isInternetReachable;

      return netInfo.isConnected === true && isReachable === true;
    } catch {
      return false;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryOperation<T>(
    operation: () => Promise<T>,
    operationId: string,
    context?: string
  ): Promise<T> {
    const attempts = this.retryAttempts.get(operationId) || 0;
    
    try {
      const result = await operation();
      // Reset retry count on success
      this.retryAttempts.delete(operationId);
      return result;
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : '';
      const logger = message.includes('AppSync URL is not configured') ? console.warn : console.error;

      logger(`Operation ${operationId} failed (attempt ${attempts + 1}):`, error);
      
      // Check if we should retry
      if (attempts < this.maxRetries && this.shouldRetry(error)) {
        this.retryAttempts.set(operationId, attempts + 1);
        
        // Exponential backoff delay
        const delay = this.retryDelay * Math.pow(2, attempts);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.retryOperation(operation, operationId, context);
      }
      
      // Max retries reached or non-retryable error
      this.retryAttempts.delete(operationId);
      throw error;
    }
  }

  /**
   * Determine if an error should be retried
   */
  private static shouldRetry(error: ErrorResponse): boolean {
    // Don't retry authorization errors
    if (error.errors?.some(e => e.errorType === 'Unauthorized')) {
      return false;
    }
    
    // Don't retry validation errors
    if (error.errors?.some(e => e.errorType === 'ValidationException')) {
      return false;
    }
    
    // Retry network errors
    if (error.message?.includes('Network request failed') || 
        error.message?.includes('fetch')) {
      return true;
    }

    if (error.message?.includes('AppSync URL is not configured')) {
      return false;
    }

    // Retry service errors
    if (error.errors?.some(e => e.errorType === 'ServiceException')) {
      return true;
    }
    
    // Retry rate limit errors
    if (error.errors?.some(e => e.errorType === 'LimitExceededException')) {
      return true;
    }
    
    return false;
  }

  /**
   * Handle offline/online state
   */
  static setupNetworkListener(
    onOnline: () => void,
    onOffline: () => void
  ): () => void {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isReachable =
        state.isInternetReachable === null || state.isInternetReachable === undefined
          ? true
          : state.isInternetReachable;

      if (state.isConnected === true && isReachable === true) {
        onOnline();
      } else {
        onOffline();
      }
    });
    
    return unsubscribe;
  }

  /**
   * Show network status alert
   */
  static showNetworkStatus(isOnline: boolean) {
    if (isOnline) {
      // Could show a brief "Back online" message
      // For now, we'll just log it
      console.log('Network connection restored');
    } else {
      Alert.alert(
        'No Internet Connection',
        'You appear to be offline. Some features may not work until your connection is restored.',
        [{ text: 'OK' }]
      );
    }
  }
}

/**
 * Higher-order function to wrap GraphQL operations with error handling
 */
export function withErrorHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  context?: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await operation(...args);
    } catch (error: any) {
      ErrorHandler.showError(error, 'Error', context);
      throw error;
    }
  };
}

/**
 * Higher-order function to wrap GraphQL operations with retry logic
 */
export function withRetry<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  operationId: string,
  context?: string
) {
  return async (...args: T): Promise<R> => {
    return ErrorHandler.retryOperation(
      () => operation(...args),
      operationId,
      context
    );
  };
}
