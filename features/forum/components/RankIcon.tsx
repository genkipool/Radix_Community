'use client';

import React from 'react';
import {
    Star, BookOpen, Activity, ShieldCheck, Eye, Zap, Medal, Award, Diamond, Crown, Trophy
} from 'lucide-react';
import { RankIconProps } from '../types/components.types';

export const RankIcon = ({ name, color, className }: RankIconProps) => {
    const c = className || "size-3";
    switch (name) {
        case 'Novato': return <Star className={c} style={{ color }} />;
        case 'Profesional': return <BookOpen className={c} style={{ color }} />;
        case 'Especialista': return <Activity className={c} style={{ color }} />;
        case 'Maestro': return <ShieldCheck className={c} style={{ color }} />;
        case 'Sabio': return <Eye className={c} style={{ color }} />;
        case 'Guru': return <Zap className={c} style={{ color }} />;
        case 'Elite': return <Medal className={c} style={{ color }} />;
        case 'Leyenda': return <Award className={c} style={{ color }} />;
        case 'Omnipotente': return <Diamond className={c} style={{ color }} />;
        case 'Omnipresente': return <Crown className={c} style={{ color }} />;
        default: return <Trophy className={c} style={{ color }} />;
    }
};
