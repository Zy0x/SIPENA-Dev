import type { AuthPort } from "../../ports/auth.port";

export const getCurrentUserUseCase = (auth: AuthPort) => auth.getCurrentUser.bind(auth);
