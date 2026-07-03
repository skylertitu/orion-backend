import { randomUUID } from 'crypto'

import { CreateApiKeyDto } from './dto/create-api-key.dto.js'
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto.js'
import { CreatePosChargeDto } from './dto/create-pos-charge.dto.js'
import { CreatePosDeviceDto } from './dto/create-pos-device.dto.js'
import { UpdateMerchantDto } from './dto/update-merchant.dto.js'

type PaymentLinkRecord = {
  id: string
  merchantId: string
  amount: number
  currency: string
  title: string
  description?: string
  expiresAt?: string
  createdAt: string
}

type MerchantRecord = {
  merchantId: string
  name?: string
  callbackUrl?: string
  active?: boolean
}

export class PaymentLinksService {
  private paymentLinks: PaymentLinkRecord[] = []
  private merchants = new Map<string, MerchantRecord>()

  createApiKey(dto: CreateApiKeyDto): { apiKey: string; merchantId: string } {
    const apiKey = `pk_${randomUUID().replace(/-/g, '')}`
    this.merchants.set(dto.merchantId, { merchantId: dto.merchantId, name: dto.name, active: true })
    return { apiKey, merchantId: dto.merchantId }
  }

  createPaymentLink(dto: CreatePaymentLinkDto): PaymentLinkRecord {
    const record: PaymentLinkRecord = {
      id: randomUUID(),
      merchantId: dto.merchantId,
      amount: dto.amount,
      currency: dto.currency,
      title: dto.title,
      description: dto.description,
      expiresAt: dto.expiresAt,
      createdAt: new Date().toISOString()
    }

    this.paymentLinks.push(record)
    return record
  }

  createPosCharge(dto: CreatePosChargeDto): { id: string } & CreatePosChargeDto {
    return { id: randomUUID(), ...dto }
  }

  createPosDevice(dto: CreatePosDeviceDto): { id: string } & CreatePosDeviceDto {
    return { id: randomUUID(), ...dto }
  }

  updateMerchant(dto: UpdateMerchantDto): MerchantRecord {
    const current = this.merchants.get(dto.merchantId) ?? { merchantId: dto.merchantId }
    const updated = { ...current, ...dto }
    this.merchants.set(dto.merchantId, updated)
    return updated
  }

  listPaymentLinks(): PaymentLinkRecord[] {
    return [...this.paymentLinks]
  }
}
