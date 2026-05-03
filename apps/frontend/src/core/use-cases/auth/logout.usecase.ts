import type { AuthPort } from "../../ports/auth.port";

export const logoutUseCase = (auth: AuthPort) => auth.logout.bind(auth);
