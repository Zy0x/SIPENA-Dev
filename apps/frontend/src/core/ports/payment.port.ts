export interface PaymentPort {
  startCheckout(planId: string): Promise<{ redirectUrl: string }>;
}
