export type PaymentRequestRecord = {
  id: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

export class PaymentRequestsService {
  private items: PaymentRequestRecord[] = []

  list(): PaymentRequestRecord[] {
    return [...this.items]
  }
}
