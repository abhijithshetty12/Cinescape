export const MIN_PASSWORD_LENGTH = 12;

export const passwordMeetsPolicy = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH;

export const getPasswordPolicyError = (password: string): string | null => {
  if (!passwordMeetsPolicy(password)) {
    return `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
};

export const getRegistrationError = (error: any): string => {
  if (error?.code === 'auth/email-already-in-use') return 'This email is already registered. Please sign in.';
  if (error?.code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (error?.code === 'auth/weak-password' || error?.code === 'auth/password-does-not-meet-requirements') {
    return 'Your password does not meet the Firebase password policy. Use at least 12 characters.';
  }
  if (error?.code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
  return error?.message || 'Registration failed. Please try again.';
};
