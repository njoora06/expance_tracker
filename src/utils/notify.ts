import { toast } from 'sonner-native';

// Single entry point for in-app feedback so every screen shows the same toast style.
export const notify = {
  success(title: string, description?: string) {
    return toast.success(title, { description });
  },
  error(title: string, description = 'Please try again.') {
    return toast.error(title, { description });
  },
  info(title: string, description?: string) {
    return toast.info(title, { description });
  },
  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) {
    toast.promise(promise, {
      loading: messages.loading,
      success: () => messages.success,
      error: messages.error,
    });
    return promise;
  },
};
