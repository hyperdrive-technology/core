import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HomePage from '../src/app/page'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('HomePage', () => {
  it('renders the home page with title', () => {
    render(<HomePage />)
    expect(screen.getByText('Inrush IDE')).toBeInTheDocument()
  })

  it('shows empty state for recent projects', () => {
    render(<HomePage />)
    expect(screen.getByText('No recent projects')).toBeInTheDocument()
  })

  it('navigates to new project when clicking new project button', () => {
    // Mock crypto.randomUUID
    const mockUUID = '123e4567-e89b-12d3-a456-426614174000'
    const originalRandomUUID = crypto.randomUUID
    crypto.randomUUID = () => mockUUID

    render(<HomePage />)

    const newProjectButton = screen.getByTestId('new-project-button')
    fireEvent.click(newProjectButton)

    expect(mockPush).toHaveBeenCalledWith(`/project/${mockUUID}`)

    // Restore original randomUUID
    crypto.randomUUID = originalRandomUUID
  })
})
