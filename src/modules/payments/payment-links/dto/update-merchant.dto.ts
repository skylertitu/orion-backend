export interface UpdateMerchantDto {
  merchantId: string
  name?: string
  callbackUrl?: string
  active?: boolean
}
