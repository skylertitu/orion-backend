export interface CreatePosChargeDto {
  merchantId: string
  amount: number
  currency: string
  posId: string
  note?: string
}
