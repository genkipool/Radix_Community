import type { DaoOnChainEntity } from '../types/radixDao.types';

export const DAO_ON_CHAIN_ENTITIES: DaoOnChainEntity[] = [
  {
    id: 'governance_component',
    address: 'component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k',
    status: 'live',
  },
  {
    id: 'master_badge',
    address: 'resource_rdx1nt4gugcmzpajreu75g2ul2whcpa48cdyn0h8n8x8zl5c0gstxn8gvd',
    status: 'live',
  },
  {
    id: 'owner_badge',
    address: 'resource_rdx1ng4c5k872hvhr379n0z0x6ht2n0guugns4jeh6mck9y28cu432xvc4',
    status: 'live',
  },
  {
    id: 'governance_package',
    address: 'package_rdx1p49s2442esdzs7wet7wucpagnftctml8aecc6a74q67r8r023u4dzn',
    status: 'live',
  },
  {
    id: 'voting_xrd',
    address: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    status: 'live',
  },
  {
    id: 'primary_treasury',
    address: 'account_rdx1c9l27suy4nte9ymge5c3eqqnnfepgf9p28d9lcsv3jvmd0f0z8j2fx',
    status: 'live',
  },
  { id: 'operational_pool', address: null, status: 'pending' },
  { id: 'reserve_pool', address: null, status: 'pending' },
  { id: 'grants_pool', address: null, status: 'pending' },
  { id: 'emergency_safe', address: null, status: 'pending' },
];
