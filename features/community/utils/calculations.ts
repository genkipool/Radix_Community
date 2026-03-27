import { Area } from '../types/data.types';

/**
 * Community calculation utilities for budgets and tasks.
 */

/**
 * Calculates total stats across all areas.
 */
export function calculateGlobalStats(areas: Area[]) {
    return {
        totalBudget: areas.reduce((s, a) => s + a.totalBudget, 0),
        spentBudget: areas.reduce((s, a) => s + a.spentBudget, 0),
        spentBudgetUsd: areas.reduce((s, a) => s + a.spentBudgetUsd, 0),
        totalTasks: areas.reduce((s, a) => s + a.tasks.length, 0),
        completedTasks: areas.reduce((s, a) => s + a.tasks.filter(tk => tk.status === 'completed').length, 0),
        totalMembers: areas.reduce((s, a) => s + a.members.length, 0),
        totalVolunteers: areas.reduce((s, a) => s + a.members.filter(m => m.isVolunteer).length, 0),
    };
}

/**
 * Recursively recomputes spent budget for an area based on its tasks.
 */
export function recomputeAreaStats(area: Area): Area {
    const nonVoluntaryTasks = area.tasks.filter(tk => tk.type !== 'voluntary');
    const newSpent = nonVoluntaryTasks.reduce((s, tk) => s + tk.cost, 0);
    const newSpentUsd = nonVoluntaryTasks.reduce((s, tk) => s + (tk.costUsd ?? 0), 0);
    
    return { 
        ...area, 
        spentBudget: newSpent, 
        spentBudgetUsd: newSpentUsd 
    };
}

/**
 * Calculates utilization percentages.
 */
export function calculateUtilization(spent: number, total: number) {
    if (total <= 0) return 0;
    return Math.round((spent / total) * 100);
}
