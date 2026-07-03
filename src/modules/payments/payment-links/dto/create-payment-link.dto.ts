export interface CreatePaymentLinkDto {
  merchantId: string
  amount: number
  currency: string
  title: string
  description?: string
  expiresAt?: string
}
