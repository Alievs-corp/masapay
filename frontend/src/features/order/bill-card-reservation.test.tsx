import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BillCard } from '@/features/order/bill-card'
import { toTableOrder, type TableOrderDto } from '@/features/order/order-api'

// Spec section 4: a seated reservation joins the table bill. The pre-ordered
// lines carry a "prepaid with reservation" mark and the prepaid amount shows
// next to the paid and remaining totals.
function dto(fullyPrepaid: boolean): TableOrderDto {
  return {
    tableId: 't1',
    tableLabel: 'Kabina 5',
    restaurantId: 'r1',
    restaurantName: 'Dolma Restoran',
    currency: 'AZN',
    serviceChargePercent: null,
    order: {
      orderId: 'o1',
      status: 'OPEN',
      totalAmount: 30,
      paidAmount: 18,
      outstanding: 12,
      equalSplit: null,
      serviceCharge: null,
      reservation: { code: 'RSV7', guestName: 'Aysel', prepaidAmount: 18 },
      items: [
        {
          id: 'a',
          name: 'Lülə kabab',
          quantity: 1,
          unitPrice: 18,
          totalPrice: 18,
          paid: fullyPrepaid,
          fromReservation: true,
        },
        {
          id: 'b',
          name: 'Çay',
          quantity: 2,
          unitPrice: 6,
          totalPrice: 12,
          paid: false,
        },
      ],
    },
  }
}

describe('BillCard with a reservation pre-order', () => {
  it('maps the reservation fields of the bill', () => {
    const order = toTableOrder(dto(true)).order!
    expect(order.reservation).toEqual({
      code: 'RSV7',
      guestName: 'Aysel',
      prepaidAmount: 1800,
    })
    expect(order.items.map((i) => i.fromReservation)).toEqual([true, false])
  })

  it('marks prepaid lines and shows the prepaid amount', () => {
    const data = toTableOrder(dto(true))
    render(<BillCard table={data} order={data.order!} />)

    expect(screen.getByText('Rezervlə öncədən ödənilib')).toBeInTheDocument()
    expect(
      screen.getByText('Rezervlə öncədən ödənilən (RSV7)'),
    ).toBeInTheDocument()
    // The non-reservation line has no reservation mark.
    expect(screen.getAllByText(/Rezervlə/)).toHaveLength(2)
  })

  it('marks a pre-ordered line that is not fully paid as reserved', () => {
    const data = toTableOrder(dto(false))
    render(<BillCard table={data} order={data.order!} />)

    expect(screen.getByText('Rezervlə sifariş edilib')).toBeInTheDocument()
    expect(screen.queryByText('Rezervlə öncədən ödənilib')).toBeNull()
  })

  it('keeps bills without a reservation unchanged', () => {
    const plain = dto(true)
    plain.order!.reservation = undefined
    plain.order!.items[0].fromReservation = undefined
    const data = toTableOrder(plain)
    render(<BillCard table={data} order={data.order!} />)

    expect(data.order!.reservation).toBeNull()
    expect(screen.queryByText(/Rezervlə/)).toBeNull()
  })
})
