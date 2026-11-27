import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DemoPage } from '@/routes/demo-page'
import { DEMO_LINKS } from '@/config/demo'
import '@/i18n'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/staff" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DemoPage', () => {
  it('links guests to the demo restaurant and staff to sign-in', () => {
    renderAt('/demo')
    expect(
      screen.getByRole('link', { name: /Masa rezerv et/ }),
    ).toHaveAttribute('href', DEMO_LINKS.reserve)
    expect(
      screen.getByRole('link', { name: /Masada QR menyu/ }),
    ).toHaveAttribute('href', DEMO_LINKS.table)
    expect(
      screen.getByRole('link', { name: /Ofisiant girişi/ }),
    ).toHaveAttribute('href', '/admin/login')
    expect(
      screen.getByRole('link', { name: /Menecer girişi/ }),
    ).toHaveAttribute('href', '/admin/login')
  })

  it('sends a typed staff address to the sign-in page', () => {
    renderAt('/staff')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})
