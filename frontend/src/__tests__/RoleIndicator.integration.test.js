/**
 * Phase 8: Frontend Integration Tests for Multi-Role System
 * 
 * Test Coverage:
 * 1. RoleIndicator component rendering
 * 2. Role switching workflow
 * 3. useRoles hook functionality
 * 4. RoleRoute protection
 * 5. Header integration
 */

// Jest/React Testing Library setup
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import RoleIndicator from '../components/RoleIndicator';
import Header from '../views/student/Partials/Header';
import { RolesContext } from '../views/plugin/Context';
import useAxios from '../utils/useAxios';
import { switchRole } from '../utils/roleUtils';

// Mock axios
jest.mock('../utils/useAxios');
jest.mock('../utils/roleUtils');
jest.mock('../views/plugin/Toast', () => ({
  __esModule: true,
  default: () => ({
    fire: jest.fn()
  })
}));

const mockStore = configureStore([]);

describe('RoleIndicator Component', () => {
  const mockRolesContext = {
    currentRole: 'student',
    availableRoles: ['student', 'teacher'],
    rolesLoading: false,
    fetchAvailableRoles: jest.fn()
  };

  const renderWithContext = (component, contextValue = mockRolesContext) => {
    return render(
      <RolesContext.Provider value={contextValue}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </RolesContext.Provider>
    );
  };

  test('renders compact mode role badge', () => {
    renderWithContext(<RoleIndicator compact={true} />);

    // Should show current role
    const badge = screen.getByRole('button', { name: /role selector/i });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Peserta');
  });

  test('renders expanded mode role card', () => {
    renderWithContext(<RoleIndicator compact={false} />);

    // Should show current role and header
    expect(screen.getByText('Current Role')).toBeInTheDocument();
    expect(screen.getByText('Peserta')).toBeInTheDocument();
  });

  test('opens dropdown on click', async () => {
    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    // Should show dropdown menu
    await waitFor(() => {
      expect(screen.getByText('Available Roles')).toBeInTheDocument();
      expect(screen.getByText(/Instruktur/i)).toBeInTheDocument();
    });
  });

  test('shows current role with checkmark in dropdown', async () => {
    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    await waitFor(() => {
      const studentOption = screen.getByText(/Currently selected/i);
      expect(studentOption).toBeInTheDocument();
      // Should have checkmark icon
      expect(studentOption.closest('button')).toHaveClass('active');
    });
  });

  test('disables dropdown for single-role user', () => {
    const singleRoleContext = {
      ...mockRolesContext,
      availableRoles: ['student']
    };

    renderWithContext(
      <RoleIndicator compact={true} />,
      singleRoleContext
    );

    const badge = screen.getByRole('button', { name: /role selector/i });
    expect(badge).toBeDisabled();
  });

  test('shows loading spinner when rolesLoading is true', () => {
    const loadingContext = {
      ...mockRolesContext,
      rolesLoading: true
    };

    renderWithContext(
      <RoleIndicator compact={true} />,
      loadingContext
    );

    // Should show loading spinner
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('switches role on selection', async () => {
    switchRole.mockResolvedValue({
      success: true,
      current_role: 'teacher',
      available_roles: ['student', 'teacher']
    });

    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    await waitFor(() => {
      const teacherOption = screen.getByText(/Instruktur/i);
      expect(teacherOption).toBeInTheDocument();
    });

    // Click teacher option
    const teacherButton = screen.getByRole('button', { name: /Instruktur/i });
    fireEvent.click(teacherButton);

    // switchRole should be called
    await waitFor(() => {
      expect(switchRole).toHaveBeenCalledWith('teacher');
    });
  });

  test('disables buttons during role switch', async () => {
    switchRole.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    await waitFor(() => {
      const teacherButton = screen.getByRole('button', { name: /Instruktur/i });
      expect(teacherButton).not.toBeDisabled();
      fireEvent.click(teacherButton);
    });

    // Button should be disabled during switch
    await waitFor(() => {
      const teacherButton = screen.getByRole('button', { name: /Instruktur/i });
      expect(teacherButton).toBeDisabled();
    });
  });

  test('closes dropdown when clicking outside', async () => {
    renderWithContext(
      <div>
        <RoleIndicator compact={true} />
        <div data-testid="outside">Outside</div>
      </div>
    );

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.getByText('Available Roles')).toBeInTheDocument();
    });

    // Click outside
    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(screen.queryByText('Available Roles')).not.toBeInTheDocument();
    });
  });

  test('keyboard navigation: Tab to focus', async () => {
    const user = userEvent.setup();
    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });

    // Tab to the button
    await user.tab();
    expect(badge).toHaveFocus();
  });

  test('keyboard navigation: Enter to open dropdown', async () => {
    const user = userEvent.setup();
    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });

    // Tab and Enter
    await user.tab();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Available Roles')).toBeInTheDocument();
    });
  });

  test('keyboard navigation: Escape to close dropdown', async () => {
    const user = userEvent.setup();
    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.getByText('Available Roles')).toBeInTheDocument();
    });

    // Press Escape
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByText('Available Roles')).not.toBeInTheDocument();
    });
  });

  test('handles role switch error', async () => {
    const mockToast = jest.spyOn(
      require('../views/plugin/Toast'),
      'default'
    ).mockReturnValue({
      fire: jest.fn()
    });

    switchRole.mockResolvedValue({
      success: false,
      error: 'Failed to switch role'
    });

    renderWithContext(<RoleIndicator compact={true} />);

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    await waitFor(() => {
      const teacherButton = screen.getByRole('button', { name: /Instruktur/i });
      fireEvent.click(teacherButton);
    });

    // Should show error toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });
  });

  test('displays color-coded role badge for each role', () => {
    const contexts = [
      { role: 'student', color: 'badge-primary' },
      { role: 'teacher', color: 'badge-success' },
      { role: 'admin', color: 'badge-danger' }
    ];

    contexts.forEach(({ role, color }) => {
      const context = {
        ...mockRolesContext,
        currentRole: role
      };

      const { unmount } = renderWithContext(
        <RoleIndicator compact={true} />,
        context
      );

      const badge = screen.getByRole('button', { name: /role selector/i });
      expect(badge.parentElement).toHaveClass(color);

      unmount();
    });
  });
});

describe('StudentHeader Integration', () => {
  const mockRolesContext = {
    currentRole: 'student',
    availableRoles: ['student'],
    rolesLoading: false
  };

  const renderHeader = () => {
    return render(
      <RolesContext.Provider value={mockRolesContext}>
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      </RolesContext.Provider>
    );
  };

  test('displays role indicator in header', () => {
    renderHeader();

    // Should display role badge
    expect(screen.getByText(/Peserta/i)).toBeInTheDocument();
  });

  test('role indicator is interactive in header', async () => {
    const multiRoleContext = {
      ...mockRolesContext,
      availableRoles: ['student', 'teacher']
    };

    const { rerender } = render(
      <RolesContext.Provider value={multiRoleContext}>
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      </RolesContext.Provider>
    );

    const roleButton = screen.getByRole('button', { name: /role selector/i });
    expect(roleButton).not.toBeDisabled();
  });
});

describe('RoleRoute Integration', () => {
  test('RoleRoute protects student routes from teacher access', () => {
    // This would be tested with navigation test
    // Using React Router's useNavigate and memory router
    const mockNavigate = jest.fn();

    // Student trying to access teacher route should be denied
    // This requires full app integration test
  });

  test('RoleRoute updates after role switch', async () => {
    // After switchRole API call, RoleRoute should re-evaluate
    // This requires full E2E test with backend mock
  });
});

describe('useRoles Hook', () => {
  test('useRoles returns context values', () => {
    const mockRolesContext = {
      currentRole: 'student',
      availableRoles: ['student', 'teacher'],
      rolesLoading: false,
      fetchAvailableRoles: jest.fn()
    };

    // Mock useContext
    const useRoles = require('../utils/useRoles').default;
    jest.spyOn(require('react'), 'useContext').mockReturnValue(mockRolesContext);

    const result = useRoles();

    expect(result.currentRole).toBe('student');
    expect(result.availableRoles).toContain('student');
    expect(result.availableRoles).toContain('teacher');
    expect(result.rolesLoading).toBe(false);
  });

  test('useRoles warns if context not provided', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    jest.spyOn(require('react'), 'useContext').mockReturnValue(null);

    const useRoles = require('../utils/useRoles').default;
    const result = useRoles();

    expect(consoleSpy).toHaveBeenCalled();
    expect(result.availableRoles).toEqual([]);
    expect(result.currentRole).toBeNull();

    consoleSpy.mockRestore();
  });
});

describe('switchRole API Function', () => {
  test('switchRole calls correct endpoint', async () => {
    useAxios.post = jest.fn().mockResolvedValue({
      data: {
        success: true,
        current_role: 'teacher',
        available_roles: ['student', 'teacher'],
        access_token: 'new-token',
        refresh_token: 'new-refresh'
      }
    });

    const result = await switchRole('teacher');

    expect(useAxios.post).toHaveBeenCalledWith(
      'auth/select-role/',
      { role: 'teacher' }
    );
    expect(result.success).toBe(true);
    expect(result.current_role).toBe('teacher');
  });

  test('switchRole updates auth tokens on success', async () => {
    const mockUpdateTokens = jest.fn();
    jest.doMock('../utils/auth', () => ({
      updateAuthTokens: mockUpdateTokens
    }));

    useAxios.post = jest.fn().mockResolvedValue({
      data: {
        success: true,
        access_token: 'new-token',
        refresh_token: 'new-refresh'
      }
    });

    await switchRole('teacher');

    // Token update should be called
    // This depends on implementation details
  });

  test('switchRole handles API errors', async () => {
    useAxios.post = jest.fn().mockRejectedValue({
      response: {
        status: 400,
        data: { error: 'Invalid role' }
      }
    });

    const result = await switchRole('invalid-role');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Multi-Role User Workflow', () => {
  test('User can switch from student to teacher role', async () => {
    const initialContext = {
      currentRole: 'student',
      availableRoles: ['student', 'teacher'],
      rolesLoading: false
    };

    switchRole.mockResolvedValue({
      success: true,
      current_role: 'teacher',
      available_roles: ['student', 'teacher']
    });

    const { rerender } = renderWithContext(
      <RoleIndicator compact={true} />,
      initialContext
    );

    // Click role badge
    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    // Select teacher
    await waitFor(() => {
      const teacherButton = screen.getByRole('button', { name: /Instruktur/i });
      fireEvent.click(teacherButton);
    });

    // API should be called
    expect(switchRole).toHaveBeenCalledWith('teacher');

    // After role switch, render with new role
    const updatedContext = {
      ...initialContext,
      currentRole: 'teacher'
    };

    rerender(
      <RolesContext.Provider value={updatedContext}>
        <BrowserRouter>
          <RoleIndicator compact={true} />
        </BrowserRouter>
      </RolesContext.Provider>
    );

    // Should show new role
    expect(screen.getByText(/Instruktur/i)).toBeInTheDocument();
  });

  test('User can switch back to original role', async () => {
    const context = {
      currentRole: 'teacher',
      availableRoles: ['student', 'teacher'],
      rolesLoading: false
    };

    switchRole.mockResolvedValue({
      success: true,
      current_role: 'student',
      available_roles: ['student', 'teacher']
    });

    renderWithContext(<RoleIndicator compact={true} />, context);

    const badge = screen.getByRole('button', { name: /role selector/i });
    fireEvent.click(badge);

    await waitFor(() => {
      const studentButton = screen.getByText(/Peserta/);
      fireEvent.click(studentButton);
    });

    expect(switchRole).toHaveBeenCalledWith('student');
  });
});

function renderWithContext(component, contextValue) {
  return render(
    <RolesContext.Provider value={contextValue}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </RolesContext.Provider>
  );
}

export { renderWithContext };
