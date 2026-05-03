import type { AuthPort } from "../../ports/auth.port";

export const loginUseCase = (auth: AuthPort) => auth.login.bind(auth);
