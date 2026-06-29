import { apiClient } from "./apiClient";

export type UserRole = "admin" | "academic_manager" | "advisor" | "teacher" | "finance";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    code: string;
  };
  roles?: Array<{ code: string; name: string }>;
  permissions?: string[];
};

export type LoginResult = {
  token: string;
  user: AuthUser;
};

export const authService = {
  login(email: string, password: string) {
    return apiClient.request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  me() {
    return apiClient.request<{ user: AuthUser }>("/auth/me");
  },

  logout() {
    return apiClient.request<{ success: boolean }>("/auth/logout", { method: "POST" });
  },
};
