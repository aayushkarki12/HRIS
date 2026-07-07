import { createTheme } from '@mui/material/styles';
import type { Shadows } from '@mui/material/styles';

// ─── Palette tokens ──────────────────────────────────────────────────────────
const INDIGO = {
  50: '#EEF2FF',
  100: '#E0E7FF',
  200: '#C7D2FE',
  500: '#6366F1',
  600: '#4F46E5',
  700: '#4338CA',
  900: '#312E81',
};

const SLATE = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
};

// ─── Shadow scale ─────────────────────────────────────────────────────────────
// MUI requires exactly 25 entries (indices 0–24)
const shadows: Shadows = [
  'none',
  '0 1px 2px rgba(0,0,0,0.05)',
  '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
  '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
  '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
  '0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
  '0 25px 50px rgba(0,0,0,0.12)',
];

// ─── Theme ────────────────────────────────────────────────────────────────────
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: INDIGO[600],
      light: INDIGO[500],
      dark: INDIGO[700],
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: SLATE[600],
      light: SLATE[500],
      dark: SLATE[700],
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#DC2626',
      light: '#EF4444',
      dark: '#B91C1C',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#D97706',
      light: '#F59E0B',
      dark: '#B45309',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#16A34A',
      light: '#22C55E',
      dark: '#15803D',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0284C7',
      light: '#38BDF8',
      dark: '#0369A1',
      contrastText: '#FFFFFF',
    },
    background: {
      default: SLATE[50],
      paper: '#FFFFFF',
    },
    text: {
      primary: SLATE[900],
      secondary: SLATE[500],
      disabled: SLATE[400],
    },
    divider: SLATE[200],
  },

  // ─── Typography ──────────────────────────────────────────────────────────────
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 14,
    htmlFontSize: 16,
    h1: { fontSize: '2rem',     fontWeight: 700, lineHeight: 1.2,  letterSpacing: '-0.025em' },
    h2: { fontSize: '1.75rem',  fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em'  },
    h3: { fontSize: '1.5rem',   fontWeight: 700, lineHeight: 1.3,  letterSpacing: '-0.015em' },
    h4: { fontSize: '1.25rem',  fontWeight: 600, lineHeight: 1.4,  letterSpacing: '-0.01em'  },
    h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4                              },
    h6: { fontSize: '1rem',     fontWeight: 600, lineHeight: 1.5                              },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.875rem',  fontWeight: 500, lineHeight: 1.5 },
    body1:     { fontSize: '0.875rem',  fontWeight: 400, lineHeight: 1.6 },
    body2:     { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.6 },
    caption:   { fontSize: '0.75rem',   fontWeight: 400, lineHeight: 1.5 },
    overline:  { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.08em', textTransform: 'uppercase' },
    button:    { fontSize: '0.875rem',  fontWeight: 500, lineHeight: 1.5, textTransform: 'none',   letterSpacing: '0' },
  },

  shape: { borderRadius: 8 },

  shadows,

  // ─── Component overrides ─────────────────────────────────────────────────────
  components: {
    // Global baseline + scrollbar + reduced-motion
    MuiCssBaseline: {
      styleOverrides: `
        *, *::before, *::after { box-sizing: border-box; }

        body {
          font-feature-settings: "cv02","cv03","cv04","cv11";
          scrollbar-width: thin;
          scrollbar-color: ${SLATE[300]} transparent;
        }

        *::-webkit-scrollbar { width: 6px; height: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: ${SLATE[300]}; border-radius: 3px; }
        *::-webkit-scrollbar-thumb:hover { background: ${SLATE[400]}; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `,
    },

    // ── Buttons ────────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          padding: '7px 14px',
          transition: 'all 150ms ease',
          '&:focus-visible': {
            outline: `2px solid ${INDIGO[600]}`,
            outlineOffset: 2,
          },
        },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        containedPrimary: {
          '&:hover': { backgroundColor: INDIGO[700] },
        },
        outlined: {
          borderColor: SLATE[300],
          color: SLATE[700],
          '&:hover': { borderColor: SLATE[400], backgroundColor: SLATE[50] },
        },
        text: {
          color: SLATE[600],
          '&:hover': { backgroundColor: SLATE[100] },
        },
        sizeLarge:  { padding: '10px 20px', fontSize: '0.9375rem' },
        sizeSmall:  { padding: '4px 10px',  fontSize: '0.8125rem', borderRadius: 5 },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          transition: 'all 150ms ease',
          color: SLATE[500],
          '&:hover': { backgroundColor: SLATE[100], color: SLATE[700] },
          '&:focus-visible': { outline: `2px solid ${INDIGO[600]}`, outlineOffset: 2 },
        },
        sizeSmall: { padding: 6 },
      },
    },

    // ── Inputs ────────────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: '0.875rem',
          backgroundColor: '#FFFFFF',
          '& fieldset': { borderColor: SLATE[300] },
          '&:hover fieldset': { borderColor: SLATE[400] },
          '&.Mui-focused fieldset': { borderColor: INDIGO[600], borderWidth: '1.5px' },
          '&.Mui-error fieldset': { borderColor: '#DC2626' },
          '&.Mui-disabled': { backgroundColor: SLATE[50] },
        },
        input: { padding: '8px 12px' },
        inputSizeSmall: { padding: '6px 10px' },
        multiline: { padding: 0 },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          color: SLATE[500],
          '&.Mui-focused': { color: INDIGO[600] },
          '&.Mui-error': { color: '#DC2626' },
        },
      },
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '0.75rem', marginTop: 4 },
      },
    },

    MuiTextField: {
      defaultProps: {
        size: 'small',
        slotProps: { inputLabel: { shrink: true } },
      },
    },

    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        select: { fontSize: '0.875rem' },
      },
    },

    // ── Paper / Card ──────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: SLATE[200] },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${SLATE[200]}`,
          borderRadius: 8,
          backgroundImage: 'none',
          transition: 'box-shadow 200ms ease, border-color 200ms ease',
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: SLATE[200] },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          fontSize: '0.75rem',
          fontWeight: 500,
          height: 24,
          border: '1px solid transparent',
        },
        sizeSmall: { height: 20, fontSize: '0.6875rem' },
        // Semantic colour overrides (filled variant)
        colorSuccess: { backgroundColor: '#DCFCE7', color: '#15803D', borderColor: '#BBF7D0' },
        colorError:   { backgroundColor: '#FEE2E2', color: '#B91C1C', borderColor: '#FECACA' },
        colorWarning: { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' },
        colorInfo:    { backgroundColor: '#E0F2FE', color: '#075985', borderColor: '#BAE6FD' },
        colorPrimary: { backgroundColor: INDIGO[50],  color: INDIGO[700], borderColor: INDIGO[200] },
        colorDefault: { backgroundColor: SLATE[100],  color: SLATE[600],  borderColor: SLATE[200] },
      },
    },

    // ── Tables ────────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: `1px solid ${SLATE[200]}`,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: 'none',
        },
      },
    },

    MuiTable: {
      styleOverrides: {
        root: { borderCollapse: 'separate', borderSpacing: 0 },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: SLATE[50],
          '& .MuiTableCell-head': {
            color: SLATE[500],
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            borderBottom: `1px solid ${SLATE[200]}`,
            padding: '10px 16px',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          },
        },
      },
    },

    MuiTableBody: {
      styleOverrides: {
        root: {
          '& .MuiTableRow-root': {
            transition: 'background-color 100ms ease',
            '&:hover': { backgroundColor: SLATE[50] },
            '&:last-child .MuiTableCell-body': { borderBottom: 'none' },
          },
          '& .MuiTableCell-body': {
            fontSize: '0.875rem',
            color: SLATE[700],
            borderBottom: `1px solid ${SLATE[100]}`,
            padding: '11px 16px',
          },
        },
      },
    },

    // ── Dialogs ───────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: 'none',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 12px 24px rgba(0,0,0,0.08)',
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 600,
          padding: '20px 24px 12px',
          color: SLATE[900],
        },
      },
    },

    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '4px 24px 16px' },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 24px 20px',
          gap: 8,
          '& .MuiButton-root': { minWidth: 80 },
        },
      },
    },

    // ── Alerts ────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: '0.875rem',
          alignItems: 'flex-start',
          border: '1px solid',
          padding: '10px 14px',
        },
        standardSuccess: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', color: '#14532D' },
        standardError:   { borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#7F1D1D' },
        standardWarning: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#78350F' },
        standardInfo:    { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF', color: '#0C4A6E' },
        icon: { paddingTop: 11 },
        message: { paddingTop: 10 },
      },
    },

    // ── Menus ─────────────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
          border: `1px solid ${SLATE[200]}`,
          minWidth: 180,
          marginTop: 4,
        },
        list: { padding: 4 },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          fontSize: '0.875rem',
          padding: '7px 10px',
          margin: '1px 0',
          minHeight: 36,
          color: SLATE[700],
          transition: 'background-color 100ms ease',
          '&:hover': { backgroundColor: SLATE[100] },
          '&.Mui-selected': {
            backgroundColor: INDIGO[50],
            color: INDIGO[700],
            fontWeight: 500,
            '&:hover': { backgroundColor: INDIGO[100] },
          },
        },
      },
    },

    // ── Lists (Sidebar navigation) ─────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '7px 10px',
          marginBottom: 1,
          transition: 'all 150ms ease',
          '&:hover': { backgroundColor: SLATE[100] },
          '&.Mui-selected': {
            backgroundColor: INDIGO[50],
            color: INDIGO[600],
            '&:hover': { backgroundColor: INDIGO[100] },
            '& .MuiListItemIcon-root': { color: INDIGO[600] },
            '& .MuiListItemText-primary': { fontWeight: 600, color: INDIGO[700] },
          },
          '&:focus-visible': { outline: `2px solid ${INDIGO[600]}`, outlineOffset: -2 },
        },
      },
    },

    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 34, color: SLATE[500] },
      },
    },

    MuiListItemText: {
      styleOverrides: {
        primary: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
      },
    },

    // ── Drawer ────────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          borderRight: `1px solid ${SLATE[200]}`,
          boxShadow: 'none',
          backgroundColor: '#FFFFFF',
        },
      },
    },

    // ── AppBar ────────────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'default' },
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${SLATE[200]}`,
          boxShadow: 'none',
          backgroundColor: '#FFFFFF',
          backgroundImage: 'none',
          color: SLATE[900],
        },
      },
    },

    // ── Tooltips ──────────────────────────────────────────────────────────────
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: SLATE[800],
          fontSize: '0.75rem',
          fontWeight: 400,
          borderRadius: 5,
          padding: '5px 10px',
          maxWidth: 280,
        },
        arrow: { color: SLATE[800] },
      },
    },

    // ── Progress ──────────────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6, backgroundColor: SLATE[200] },
        bar:  { borderRadius: 4 },
      },
    },

    MuiCircularProgress: {
      defaultProps: { size: 24 },
    },

    // ── Badge ─────────────────────────────────────────────────────────────────
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: '0.625rem',
          fontWeight: 600,
          minWidth: 18,
          height: 18,
          padding: '0 4px',
          borderRadius: 9,
        },
      },
    },

    // ── Skeleton ──────────────────────────────────────────────────────────────
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: SLATE[100] },
      },
    },

    // ── Tabs ──────────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          fontWeight: 500,
          textTransform: 'none',
          minHeight: 44,
          letterSpacing: 0,
          color: SLATE[500],
          '&.Mui-selected': { color: INDIGO[600], fontWeight: 600 },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, borderRadius: 1, backgroundColor: INDIGO[600] },
      },
    },

    // ── Avatar ────────────────────────────────────────────────────────────────
    MuiAvatar: {
      styleOverrides: {
        root: { fontSize: '0.875rem', fontWeight: 600 },
        colorDefault: { backgroundColor: INDIGO[100], color: INDIGO[700] },
      },
    },

    // ── Accordion ────────────────────────────────────────────────────────────
    MuiAccordion: {
      styleOverrides: {
        root: {
          border: `1px solid ${SLATE[200]}`,
          borderRadius: '8px !important',
          boxShadow: 'none',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
        },
      },
    },

    // ── Toggle Button ─────────────────────────────────────────────────────────
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: '0.875rem',
          textTransform: 'none',
          fontWeight: 500,
          padding: '6px 14px',
          borderColor: SLATE[300],
          color: SLATE[600],
          '&.Mui-selected': {
            backgroundColor: INDIGO[50],
            color: INDIGO[700],
            borderColor: INDIGO[200],
            fontWeight: 600,
          },
        },
      },
    },

    // ── Breadcrumbs ───────────────────────────────────────────────────────────
    MuiBreadcrumbs: {
      styleOverrides: {
        root: { fontSize: '0.8125rem', color: SLATE[500] },
        separator: { color: SLATE[300] },
        li: { '& a': { color: SLATE[500], textDecoration: 'none', '&:hover': { color: SLATE[700] } } },
      },
    },

    // ── Autocomplete ─────────────────────────────────────────────────────────
    MuiAutocomplete: {
      styleOverrides: {
        paper: { borderRadius: 8, border: `1px solid ${SLATE[200]}`, boxShadow: '0 10px 15px rgba(0,0,0,0.1)' },
        option: {
          fontSize: '0.875rem',
          '&:hover': { backgroundColor: SLATE[100] },
          '&[aria-selected="true"]': { backgroundColor: INDIGO[50], color: INDIGO[700] },
        },
        inputRoot: { gap: 4 },
      },
    },

    // ── Switch ────────────────────────────────────────────────────────────────
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': { color: INDIGO[600] },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: INDIGO[600] },
        },
      },
    },
  },
});
