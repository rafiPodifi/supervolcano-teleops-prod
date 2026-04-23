export type FriendlyErrorCategory =
  | 'no_internet'
  | 'upload_failed'
  | 'permission_needed'
  | 'recording_unavailable'
  | 'something_went_wrong'
  | 'login_failed';

export type FriendlyErrorContext =
  | 'fatal'
  | 'login'
  | 'locations'
  | 'tasks'
  | 'queue'
  | 'upload'
  | 'recording'
  | 'location_save'
  | 'generic';

export interface FriendlyErrorCopy {
  title: string;
  message: string;
  category: FriendlyErrorCategory;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  if (typeof error === 'string') {
    return error.toLowerCase();
  }

  if (error && typeof error === 'object') {
    const maybeError = error as { code?: string; message?: string; name?: string };
    return `${maybeError.code || ''} ${maybeError.message || ''} ${maybeError.name || ''}`
      .trim()
      .toLowerCase();
  }

  return '';
}

function isNoInternetError(normalized: string): boolean {
  return (
    normalized.includes('network') ||
    normalized.includes('internet') ||
    normalized.includes('offline') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('failed to fetch')
  );
}

function isPermissionError(normalized: string): boolean {
  return (
    normalized.includes('permission') ||
    normalized.includes('denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('camera access') ||
    normalized.includes('microphone')
  );
}

export const PRODUCTION_FATAL_ERROR_COPY: FriendlyErrorCopy = {
  title: 'Something went wrong',
  message:
    'Please close and reopen the app. If the problem continues, contact support.',
  category: 'something_went_wrong',
};

export function getFriendlyErrorCopy(
  error: unknown,
  context: FriendlyErrorContext = 'generic'
): FriendlyErrorCopy {
  const normalized = stringifyError(error);

  if (context === 'fatal') {
    return PRODUCTION_FATAL_ERROR_COPY;
  }

  if (context === 'login') {
    if (normalized.includes('user-not-found') || normalized.includes('not found')) {
      return {
        title: 'Login Error',
        message: 'No account found with this email.',
        category: 'login_failed',
      };
    }

    if (
      normalized.includes('wrong-password') ||
      normalized.includes('invalid-credential') ||
      normalized.includes('incorrect password')
    ) {
      return {
        title: 'Login Error',
        message: 'Incorrect email or password.',
        category: 'login_failed',
      };
    }

    if (normalized.includes('invalid-email')) {
      return {
        title: 'Login Error',
        message: 'Please enter a valid email address.',
        category: 'login_failed',
      };
    }

    if (normalized.includes('too-many-requests')) {
      return {
        title: 'Login Error',
        message: 'Too many attempts. Please try again later.',
        category: 'login_failed',
      };
    }

    if (normalized.includes('does not have access') || normalized.includes('access denied')) {
      return {
        title: 'Access Denied',
        message: 'Your account does not have access to the mobile app.',
        category: 'login_failed',
      };
    }

    if (normalized.includes('organization')) {
      return {
        title: 'Login Error',
        message: 'Your account is not assigned correctly. Please contact your manager.',
        category: 'login_failed',
      };
    }

    if (normalized.includes('profile')) {
      return {
        title: 'Login Error',
        message: 'Your account is not set up yet. Please contact support.',
        category: 'login_failed',
      };
    }
  }

  if (isNoInternetError(normalized)) {
    if (context === 'upload') {
      return {
        title: 'No internet',
        message:
          'Upload failed because the device is offline. Your video is still saved and you can retry when you are back online.',
        category: 'no_internet',
      };
    }

    return {
      title: 'No internet',
      message: 'Check your connection and try again.',
      category: 'no_internet',
    };
  }

  if (isPermissionError(normalized)) {
    if (context === 'recording') {
      return {
        title: 'Permission needed',
        message: 'Allow camera and microphone access to keep recording.',
        category: 'permission_needed',
      };
    }

    return {
      title: 'Permission needed',
      message: 'Please allow the required permissions and try again.',
      category: 'permission_needed',
    };
  }

  if (context === 'locations') {
    return {
      title: 'Something went wrong',
      message: 'We couldn’t load your locations. Please try again.',
      category: 'something_went_wrong',
    };
  }

  if (context === 'tasks') {
    return {
      title: 'Something went wrong',
      message: 'We couldn’t load tasks right now. Please try again.',
      category: 'something_went_wrong',
    };
  }

  if (context === 'queue') {
    return {
      title: 'Something went wrong',
      message: 'The recording could not be saved right now. Please try again.',
      category: 'something_went_wrong',
    };
  }

  if (context === 'upload') {
    return {
      title: 'Upload failed',
      message:
        'The video could not be uploaded right now. You can retry it from Failed uploads.',
      category: 'upload_failed',
    };
  }

  if (context === 'recording') {
    return {
      title: 'Recording unavailable',
      message: 'Please try recording again.',
      category: 'recording_unavailable',
    };
  }

  if (context === 'location_save') {
    return {
      title: 'Something went wrong',
      message: 'We couldn’t save this location. Please try again.',
      category: 'something_went_wrong',
    };
  }

  if (context === 'login') {
    return {
      title: 'Login Error',
      message: 'Something went wrong while signing in. Please try again.',
      category: 'login_failed',
    };
  }

  return {
    title: 'Something went wrong',
    message: 'Please try again.',
    category: 'something_went_wrong',
  };
}
