import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TipsDashboard from './TipsDashboard';

// Mock suprabase client
vi.mock('../lib/supabase', () => {
    return {
        supabase: {
            from: vi.fn(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({
                        data: [{ id: 999, data_jogo: '2026-02-22', time_casa: '', time_fora: '', palpite_principal: '', over_line: '', under_line: '', p_combinados: '-', confianca: '', n_casa: '-', n_fora: '-' }],
                        error: null
                    })
                }),
            }))
        }
    };
});

// Mock html-to-image
vi.mock('html-to-image', () => ({
    toPng: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

describe('TipsDashboard', () => {
    const mockTeams = [
        { id: '1', name: 'Lakers', logo: 'lakers.png' },
        { id: '2', name: 'Celtics', logo: 'celtics.png' }
    ];
    const mockPlayerStats = [
        { id: '1', nome: 'LeBron', time: 'Lakers', pontos: 25.5, rebotes: 8, assistencias: 7, pos: 'SF', min: 35 }
    ];
    const mockUnavailable = [
        { player_name: 'Davis', team_name: 'Lakers', injury_status: 'OUT' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly with headers', async () => {
        render(<TipsDashboard teams={mockTeams} playerStats={mockPlayerStats} unavailablePlayers={mockUnavailable} dbPredictions={[]} />);

        await waitFor(() => {
            expect(screen.getByText(/Predictor/i)).toBeInTheDocument();
        });
    });

    it('renders "No active nodes" when there are no predictions', async () => {
        render(<TipsDashboard teams={mockTeams} playerStats={mockPlayerStats} unavailablePlayers={mockUnavailable} dbPredictions={[]} />);

        await waitFor(() => {
            expect(screen.getByText(/No active nodes for/i)).toBeInTheDocument();
        });
    });

    it('adds a new prediction row when button is clicked', async () => {
        render(<TipsDashboard teams={mockTeams} playerStats={mockPlayerStats} unavailablePlayers={mockUnavailable} dbPredictions={[]} />);

        let initBtn;
        await waitFor(() => {
            initBtn = screen.getByText(/\+ INITIALIZE NODE/i);
            expect(initBtn).toBeInTheDocument();
        });

        if (initBtn) fireEvent.click(initBtn);

        await waitFor(() => {
            expect(document.querySelector('.lucide-trash-2')).toBeInTheDocument();
        });
    });
});
