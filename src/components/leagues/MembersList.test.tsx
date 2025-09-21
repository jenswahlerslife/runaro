import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MembersList from './MembersList';

const mockMembers = [
  {
    id: '1',
    user_id: 'user1',
    display_name: 'Test User 1',
    role: 'owner' as const,
    joined_at: '2023-01-01T00:00:00Z'
  },
  {
    id: '2',
    user_id: 'user2',
    display_name: 'Test User 2',
    role: 'member' as const,
    joined_at: '2023-01-02T00:00:00Z'
  }
];

const defaultProps = {
  members: mockMembers,
  isAdmin: true,
  sortField: 'display_name' as const,
  sortDirection: 'asc' as const,
  onSortChange: vi.fn(),
  onRoleChange: vi.fn(),
  onRemoveMember: vi.fn()
};

describe('MembersList', () => {
  it('renders member list correctly', () => {
    render(<MembersList {...defaultProps} />);

    expect(screen.getByText('Test User 1')).toBeInTheDocument();
    expect(screen.getByText('Test User 2')).toBeInTheDocument();
    expect(screen.getByText('ejer')).toBeInTheDocument();
    expect(screen.getByText('medlem')).toBeInTheDocument();
  });

  it('shows admin actions when user is admin', () => {
    render(<MembersList {...defaultProps} />);

    // Owner shouldn't have action buttons
    expect(screen.queryByText('Fjern admin')).not.toBeInTheDocument();

    // Member should have promote and remove buttons
    expect(screen.getByText('Gør til admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trash/i })).toBeInTheDocument();
  });

  it('hides admin actions when user is not admin', () => {
    render(<MembersList {...defaultProps} isAdmin={false} />);

    expect(screen.queryByText('Gør til admin')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /trash/i })).not.toBeInTheDocument();
  });

  it('calls onRoleChange when promoting member', async () => {
    const mockRoleChange = vi.fn().mockResolvedValue(undefined);
    render(<MembersList {...defaultProps} onRoleChange={mockRoleChange} />);

    const promoteButton = screen.getByText('Gör til admin');
    fireEvent.click(promoteButton);

    await waitFor(() => {
      expect(mockRoleChange).toHaveBeenCalledWith('2', 'admin');
    });
  });

  it('calls onSortChange when clicking sort button', () => {
    const mockSortChange = vi.fn();
    render(<MembersList {...defaultProps} onSortChange={mockSortChange} />);

    const nameSort = screen.getByText('Navn');
    fireEvent.click(nameSort);

    expect(mockSortChange).toHaveBeenCalledWith('display_name');
  });

  it('shows correct sort direction indicator', () => {
    render(<MembersList {...defaultProps} sortDirection="desc" />);

    // Should show down chevron for desc
    expect(document.querySelector('[data-testid="chevron-down"]') ||
           document.querySelector('.lucide-chevron-down')).toBeInTheDocument();
  });

  it('displays formatted join date', () => {
    render(<MembersList {...defaultProps} />);

    // Danish date format
    expect(screen.getByText('01.01.2023')).toBeInTheDocument();
    expect(screen.getByText('02.01.2023')).toBeInTheDocument();
  });
});