import type { AuthPort } from "../../ports/auth.port";

export const registerUseCase = (auth: AuthPort) => auth.register.bind(auth);
