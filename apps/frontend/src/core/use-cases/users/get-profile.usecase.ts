import type { AuthPort } from "../../ports/auth.port";

export const getProfileUseCase = (auth: AuthPort) => auth.getCurrentUser();
