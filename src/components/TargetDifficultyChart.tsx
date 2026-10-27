import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { InactiveTarget } from '../types/torn';

interface TargetDifficultyChartProps {
  targets: InactiveTarget[];
}

const DIFFICULTY_COLORS: Record<string, string> = {
  VERY_EASY: '#22c55e', // Green-500
  EASY: '#a855f7',      // Purple-500
  MEDIUM: '#eab308',    // Yellow-500
  HARD: '#f97316',      // Orange-500
  DANGER: '#ef4444',    // Red-500
  UNAVAILABLE: '#64748b', // Slate-500
};

const DIFFICULTY_LABELS: Record<string, string> = {
  VERY_EASY: 'Very Easy',
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  DANGER: 'Danger',
  UNAVAILABLE: 'Unavailable',
};

export const TargetDifficultyChart: React.FC<TargetDifficultyChartProps> = ({ targets }) => {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    
    targets.forEach((t) => {
      const diff = t.ffScouter.difficulty;
      counts[diff] = (counts[diff] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name: DIFFICULTY_LABELS[name] || name,
      value,
      color: DIFFICULTY_COLORS[name] || '#64748b',
    }));
  }, [targets]);

  if (targets.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg mb-6">
      <h3 className="text-sm font-mono text-slate-400 mb-4">Difficulty Distribution</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={40}
              outerRadius={70}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
