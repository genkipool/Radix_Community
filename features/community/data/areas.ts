import { Area } from '../types/data.types';
import { DEVELOPER_DATA } from '../areas/developer/data/areaData';
import { MARKETING_DATA } from '../areas/marketing/data/areaData';
import { EDUCATION_DATA } from '../areas/education/data/areaData';
import { INFRASTRUCTURE_DATA } from '../areas/infrastructure/data/areaData';
import { GOVERNANCE_DATA } from '../areas/governance/data/areaData';
import { SECURITY_DATA } from '../areas/security/data/areaData';

export const AREAS: Area[] = [
    DEVELOPER_DATA,
    MARKETING_DATA,
    EDUCATION_DATA,
    INFRASTRUCTURE_DATA,
    GOVERNANCE_DATA,
    SECURITY_DATA,
];
